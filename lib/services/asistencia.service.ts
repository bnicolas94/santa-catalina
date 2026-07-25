import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { SancionService } from './sancion.service'
import { fechaClaveRRHH, instanteRRHH, rangoDiaRRHH, sumarDiasRRHH } from '@/lib/rrhh/fechas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ImportarFichadaInput {
    codigoBiometrico: string
    fechaHora: string
    tipo: 'entrada' | 'salida'
}

export interface ImportResult {
    success: boolean
    importados: number
    errores: string[]
}

export interface ResumenAsistenciaDia {
    fecha: string
    diaSemana: string
    horasTrabajadas: number
    horasExtras: number
    entrada: string | null
    salida: string | null
    esFeriado: boolean
    nombreFeriado?: string
    esAusencia: boolean
    esJustificado: boolean
    tardanzaMinutos: number
}

// ─── Servicio ────────────────────────────────────────────────────────────────

export class AsistenciaService {

    /**
     * Procesa un array de registros de fichadas, mapea códigos biométricos
     * a empleados, y crea los registros evitando duplicados.
     */
    static async importarFichadas(registros: ImportarFichadaInput[]): Promise<ImportResult> {
        if (!registros || !Array.isArray(registros)) {
            throw new Error('Formato inválido. Se espera un array de registros.')
        }

        let importados = 0
        const errores: string[] = []

        // Obtener mapa de código biométrico → empleado completo (con turno)
        const empleadosData = await prisma.empleado.findMany({
            where: { codigoBiometrico: { not: null } },
            include: { turno: true }
        })
 
        // Normalizamos: "00011" -> "11"
        const mapEmpleados = new Map(empleadosData.map(e => {
            const raw = e.codigoBiometrico || ""
            const normalized = raw.replace(/^0+/, '')
            return [normalized, e]
        }))
 
        for (const reg of registros) {
            const regRaw = reg.codigoBiometrico?.toString() || ""
            const regNormalized = regRaw.replace(/^0+/, '')
 
            const emp = mapEmpleados.get(regNormalized)
            const empleadoId = emp?.id
 
            if (!empleadoId) {
                errores.push(`No se encontró empleado con código biométrico: ${regRaw} (Normalizado: ${regNormalized})`)
                continue
            }
 
            try {
                const fecha = new Date(reg.fechaHora)
                const tipo = reg.tipo.toLowerCase()
                const lockKey = `fichada:${empleadoId}:${fecha.toISOString()}:${tipo}`

                const resultado = await prisma.$transaction(async (tx) => {
                    // Serializa importaciones concurrentes de la misma marca sin
                    // requerir depurar previamente los duplicados históricos.
                    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

                    const existe = await tx.fichadaEmpleado.findFirst({
                        where: { empleadoId, fechaHora: fecha, tipo }
                    })

                    if (existe) return { creada: false, tieneTardanza: false }

                    await tx.fichadaEmpleado.create({
                        data: {
                            empleadoId,
                            fechaHora: fecha,
                            tipo,
                            origen: 'importado'
                        }
                    })

                    let tieneTardanza = false
                    if (tipo === 'entrada') {
                        const mins = this.calcularTardanza(fecha, emp.horarioEntrada, emp.turno)
                        if (mins > 0) {
                            tieneTardanza = true
                            const fechaLocal = fechaClaveRRHH(fecha)
                            const rangoDia = rangoDiaRRHH(fechaLocal)
                            const tardanzaLockKey = `tardanza:${empleadoId}:${fechaLocal}`
                            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tardanzaLockKey}))`

                            const existeTardanza = await tx.inasistencia.findFirst({
                                where: {
                                    empleadoId,
                                    tipo: 'TARDANZA',
                                    fecha: { gte: rangoDia.gte, lt: rangoDia.lt }
                                }
                            })

                            if (!existeTardanza) {
                                await tx.inasistencia.create({
                                    data: {
                                        empleadoId,
                                        fecha,
                                        tipo: 'TARDANZA',
                                        minutosRetraso: mins,
                                        observaciones: `Llegada tarde detectada automáticamente al importar fichada (${mins} min de retraso).`
                                    }
                                })
                            }
                        }
                    }

                    return { creada: true, tieneTardanza }
                })

                if (resultado.creada) importados++
                if (resultado.tieneTardanza) {
                    // Las alertas se procesan una vez confirmada la fichada.
                    await SancionService.checkAndApplyAlerts(empleadoId)
                }
            } catch (err: any) {
                errores.push(`Error al insertar registro para empleado ${empleadoId}: ${err.message}`)
            }
        }
 
        // Evento de dominio
        if (importados > 0) {
            eventBus.emit('fichadas:imported', { importados, errores: errores.length })
            
            // AUTO-DETECCIÓN DE AUSENCIAS PARA LOS DÍAS IMPORTADOS (SOLO DÍAS PASADOS)
            try {
                const fechasUnicas = [...new Set(registros.map(r => r.fechaHora.split('T')[0]))]
                const hoyStr = fechaClaveRRHH(new Date())
                
                for (const fecha of fechasUnicas) {
                    if (fecha < hoyStr) {
                        await this.procesarAusenciasAutomaticas(fecha)
                    }
                }
            } catch (autoErr) {
                console.error('Error en auto-detección de ausencias tras importación:', autoErr)
            }
        }
 
        return {
            success: true,
            importados,
            errores
        }
    }

    // ─── Listar Fichadas ─────────────────────────────────────────────────────
    static async findFichadas(params: { empleadoId?: string, mes?: string }) {
        const where: any = {}

        if (params.empleadoId) {
            where.empleadoId = params.empleadoId
        }

        if (params.mes) {
            const [anio, mes] = params.mes.split('-').map(Number)
            const siguienteMes = mes === 12
                ? `${anio + 1}-01-01`
                : `${anio}-${String(mes + 1).padStart(2, '0')}-01`

            where.fechaHora = {
                gte: instanteRRHH(`${params.mes}-01`),
                lt: instanteRRHH(siguienteMes)
            }
        }

        return prisma.fichadaEmpleado.findMany({
            where,
            orderBy: { fechaHora: 'desc' },
            include: {
                empleado: {
                    select: { nombre: true, apellido: true }
                },
                tipoLicencia: true
            }
        })
    }

    // ─── Crear Fichada Manual ────────────────────────────────────────────────
    static async crearFichadaManual(params: {
        empleadoId: string
        fechaHora: string
        tipo: string
        origen?: string
        tipoLicenciaId?: string | null
    }) {
        if (!params.empleadoId || !params.fechaHora || !params.tipo) {
            throw new Error('Datos incompletos para crear fichada')
        }

        const fecha = new Date(params.fechaHora)
        const fichada = await prisma.fichadaEmpleado.create({
            data: {
                empleadoId: params.empleadoId,
                fechaHora: fecha,
                tipo: params.tipo,
                origen: params.origen || 'manual',
                tipoLicenciaId: params.tipoLicenciaId || null
            }
        })

        // REGISTRO AUTOMÁTICO EN LEGAJO SI ES TARDANZA (Manual)
        if (params.tipo.toLowerCase() === 'entrada') {
            const emp = await prisma.empleado.findUnique({
                where: { id: params.empleadoId },
                include: { turno: true }
            })
            if (emp) {
                const mins = this.calcularTardanza(fecha, emp.horarioEntrada, emp.turno)
                if (mins > 0) {
                    await prisma.inasistencia.create({
                        data: {
                            empleadoId: params.empleadoId,
                            fecha: fecha,
                            tipo: 'TARDANZA',
                            minutosRetraso: mins,
                            observaciones: `Llegada tarde registrada manualmente (${mins} min de retraso).`
                        }
                    })
                    // Disparar chequeo de alertas para posibles sanciones automáticas
                    await SancionService.checkAndApplyAlerts(params.empleadoId)
                }
            }
        }

        eventBus.emit('fichada:created', { empleadoId: params.empleadoId, tipo: params.tipo })
        return fichada
    }

    // ─── Detectar Tardanzas ──────────────────────────────────────────────────
    /**
     * Compara la hora de entrada real con el horario configurado del empleado.
     * Retorna minutos de tardanza (0 si llegó a tiempo o antes).
     */
    static calcularTardanza(
        horaEntradaReal: Date,
        horarioEntrada: string | null, // Legacy o fallback
        turno?: { horaInicio: string, toleranciaMinutos: number } | null
    ): number {
        const horaObjetivo = turno?.horaInicio || horarioEntrada
        if (!horaObjetivo) return 0

        const toleranciaMin = turno?.toleranciaMinutos ?? 10

        const [h, m] = horaObjetivo.split(':').map(Number)
        const limiteEntrada = new Date(horaEntradaReal)
        limiteEntrada.setHours(h, m + toleranciaMin, 0, 0)

        if (horaEntradaReal > limiteEntrada) {
            return Math.round((horaEntradaReal.getTime() - limiteEntrada.getTime()) / (1000 * 60))
        }

        return 0
    }

    // ─── Detectar Ausencias de un Día ────────────────────────────────────────
    /**
     * Retorna los empleados activos que no tienen fichadas para la fecha dada.
     */
    static async detectarAusencias(fecha: string) {
        const rangoDia = rangoDiaRRHH(fecha)

        // Empleados activos
        const empleadosActivos = await prisma.empleado.findMany({
            where: { activo: true },
            select: { 
                id: true, 
                nombre: true, 
                apellido: true, 
                horarioEntrada: true,
                turno: { select: { horaInicio: true } },
                diasTrabajoSemana: true
            }
        })

        // Empleados con fichadas ese día
        const fichadasDelDia = await prisma.fichadaEmpleado.findMany({
            where: {
                fechaHora: { gte: rangoDia.gte, lt: rangoDia.lt }
            },
            select: { empleadoId: true }
        })

        const idsConFichada = new Set(fichadasDelDia.map(f => f.empleadoId))

        const targetDate = new Date(`${fecha}T12:00:00Z`)
        const dayOfWeek = targetDate.getUTCDay() // 0: Domingo, 6: Sábado

        return empleadosActivos.filter(e => {
            const tieneHorario = e.turno?.horaInicio || e.horarioEntrada
            if (!tieneHorario || idsConFichada.has(e.id)) return false

            const diasStr = (e.diasTrabajoSemana || "Lunes a Viernes").toLowerCase()

            // Si es Domingo (0) y su configuración no incluye "domingo", es franco
            if (dayOfWeek === 0 && !diasStr.includes('domingo')) return false

            // Si es Sábado (6) y su configuración es "lunes a viernes", es franco
            if (dayOfWeek === 6 && diasStr.includes('lunes a viernes')) return false

            return true
        })
    }

    /**
     * Detecta ausencias para una fecha y crea registros de Inasistencia INJUSTIFICADA.
     * Retorna el número de ausencias registradas.
     */
    static async procesarAusenciasAutomaticas(fecha: string) {
        const ausentes = await this.detectarAusencias(fecha)
        let creados = 0

        const targetDate = instanteRRHH(fecha, '12:00:00')

        for (const emp of ausentes) {
            // Verificar si ya existe un registro de inasistencia para ese día
            const rangoDia = rangoDiaRRHH(fecha)
            
            const existe = await prisma.inasistencia.findFirst({
                where: {
                    empleadoId: emp.id,
                    fecha: { gte: rangoDia.gte, lt: rangoDia.lt }
                }
            })

            if (!existe) {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId: emp.id,
                        fecha: targetDate,
                        tipo: 'INJUSTIFICADA',
                        motivo: 'Ausencia detectada automáticamente por falta de fichada.',
                        observaciones: 'Generado automáticamente por el sistema.'
                    }
                })
                creados++
                // Disparar chequeo de alertas
                await SancionService.checkAndApplyAlerts(emp.id)
            }
        }

        return creados
    }

    /**
     * Procesa ausencias para un rango de fechas.
     */
    static async procesarAusenciasRango(desde: string, hasta: string) {
        let totalCreados = 0
        let fechaStr = sumarDiasRRHH(desde, 0)
        const fechaFin = sumarDiasRRHH(hasta, 0)

        while (fechaStr <= fechaFin) {
            const creados = await this.procesarAusenciasAutomaticas(fechaStr)
            totalCreados += creados
            fechaStr = sumarDiasRRHH(fechaStr, 1)
        }

        return totalCreados
    }
}
