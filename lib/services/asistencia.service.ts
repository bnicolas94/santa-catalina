import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { SancionService } from './sancion.service'
import { cargarPlanHorarios } from '@/lib/services/horarios-empleado.service'
import { resolverHorarioPlanificado, minutosTardanzaHorario } from '@/lib/rrhh/horarios'
import { fechaClaveRRHH, instanteRRHH, rangoDiaRRHH, sumarDiasRRHH } from '@/lib/rrhh/fechas'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ImportarFichadaInput {
    codigoBiometrico: string
    fechaHora: string
    tipo: 'entrada' | 'salida'
    fuente?: 'fabrica_txt' | 'local_xls'
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
 
        const registrosResueltos: Array<{
            empleadoId: string
            empleado: typeof empleadosData[number]
            fecha: Date
            tipo: 'entrada' | 'salida'
        }> = []
        const clavesRecibidas = new Set<string>()

        for (const reg of registros) {
            const regRaw = reg.codigoBiometrico?.toString() || ""
            const regNormalized = regRaw.replace(/^0+/, '')
            const emp = mapEmpleados.get(regNormalized)

            if (!emp) {
                errores.push(`No se encontró empleado con código biométrico: ${regRaw} (Normalizado: ${regNormalized})`)
                continue
            }

            const fecha = new Date(reg.fechaHora)
            const tipoNormalizado = reg.tipo?.toLowerCase()
            if (Number.isNaN(fecha.getTime()) || (tipoNormalizado !== 'entrada' && tipoNormalizado !== 'salida')) {
                errores.push(`Fichada inválida para el código biométrico ${regRaw}.`)
                continue
            }

            const tipo = tipoNormalizado as 'entrada' | 'salida'
            const clave = `${emp.id}|${fecha.toISOString()}|${tipo}`
            if (clavesRecibidas.has(clave)) continue

            clavesRecibidas.add(clave)
            registrosResueltos.push({ empleadoId: emp.id, empleado: emp, fecha, tipo })
        }

        if (registrosResueltos.length === 0) {
            return { success: true, importados: 0, errores }
        }

        const empleadosIds = [...new Set(registrosResueltos.map(registro => registro.empleadoId))]
        const fechasPlan = registrosResueltos.map(registro => fechaClaveRRHH(registro.fecha)).sort()
        const planHorarios = await cargarPlanHorarios(empleadosIds, fechasPlan[0], fechasPlan[fechasPlan.length - 1])
        const fechasLocales = registrosResueltos.map(registro => fechaClaveRRHH(registro.fecha)).sort()
        const rangoImportacion = {
            gte: rangoDiaRRHH(fechasLocales[0]).gte,
            lt: rangoDiaRRHH(fechasLocales[fechasLocales.length - 1]).lt,
        }

        const resultado = await prisma.$transaction(async (tx) => {
            // Una importación se procesa como lote para evitar una ida a la base por cada marca.
            // El bloqueo conserva la idempotencia frente a dos confirmaciones simultáneas.
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('fichadas:importar'))::text AS lock_result`

            const existentes = await tx.fichadaEmpleado.findMany({
                where: {
                    empleadoId: { in: empleadosIds },
                    fechaHora: rangoImportacion,
                },
                select: { empleadoId: true, fechaHora: true, tipo: true },
            })
            const clavesExistentes = new Set(existentes.map(fichada =>
                `${fichada.empleadoId}|${fichada.fechaHora.toISOString()}|${fichada.tipo.toLowerCase()}`))
            const nuevas = registrosResueltos.filter(registro =>
                !clavesExistentes.has(`${registro.empleadoId}|${registro.fecha.toISOString()}|${registro.tipo}`))

            if (nuevas.length > 0) {
                await tx.fichadaEmpleado.createMany({
                    data: nuevas.map(registro => ({
                        empleadoId: registro.empleadoId,
                        fechaHora: registro.fecha,
                        tipo: registro.tipo,
                        origen: 'importado',
                    })),
                })
            }

            const tardanzasExistentes = await tx.inasistencia.findMany({
                where: {
                    empleadoId: { in: empleadosIds },
                    tipo: 'TARDANZA',
                    fecha: rangoImportacion,
                },
                select: { empleadoId: true, fecha: true },
            })
            const clavesTardanza = new Set(tardanzasExistentes.map(tardanza =>
                `${tardanza.empleadoId}|${fechaClaveRRHH(tardanza.fecha)}`))

            // Sólo la primera entrada de cada jornada puede generar tardanza. Una segunda
            // entrada (por corte o turno partido) no se compara con el inicio del día.
            const entradasPorDia = new Map<string, typeof registrosResueltos[number] | null>()
            const todasLasEntradas: Array<{
                empleadoId: string
                fecha: Date
                registro: typeof registrosResueltos[number] | null
            }> = [
                ...existentes
                    .filter(fichada => fichada.tipo.toLowerCase() === 'entrada')
                    .map(fichada => ({ empleadoId: fichada.empleadoId, fecha: fichada.fechaHora, registro: null })),
                ...nuevas
                    .filter(registro => registro.tipo === 'entrada')
                    .map(registro => ({ empleadoId: registro.empleadoId, fecha: registro.fecha, registro })),
            ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

            for (const entrada of todasLasEntradas) {
                const claveDia = `${entrada.empleadoId}|${fechaClaveRRHH(entrada.fecha)}`
                if (!entradasPorDia.has(claveDia)) {
                    entradasPorDia.set(claveDia, entrada.registro)
                }
            }

            const tardanzasNuevas: Array<{
                empleadoId: string
                fecha: Date
                tipo: string
                minutosRetraso: number
                observaciones: string
            }> = []
            for (const [claveDia, registro] of entradasPorDia.entries()) {
                if (!registro || clavesTardanza.has(claveDia)) continue

                const horario = resolverHorarioPlanificado(planHorarios, registro.empleadoId, fechaClaveRRHH(registro.fecha))
                const minutos = horario ? minutosTardanzaHorario(registro.fecha, horario) : this.calcularTardanza(
                    registro.fecha,
                    registro.empleado.horarioEntrada,
                    registro.empleado.turno,
                )
                if (minutos <= 0) continue

                tardanzasNuevas.push({
                    empleadoId: registro.empleadoId,
                    fecha: registro.fecha,
                    tipo: 'TARDANZA',
                    minutosRetraso: minutos,
                    observaciones: `Llegada tarde detectada automáticamente al importar fichada (${minutos} min de retraso).`,
                })
                clavesTardanza.add(claveDia)
            }

            if (tardanzasNuevas.length > 0) {
                await tx.inasistencia.createMany({ data: tardanzasNuevas })
            }

            return {
                importados: nuevas.length,
                empleadosConTardanza: [...new Set(tardanzasNuevas.map(tardanza => tardanza.empleadoId))],
            }
        }, { maxWait: 10_000, timeout: 30_000 })

        // Las alertas se verifican una sola vez por empleado, fuera de la transacción del lote.
        await Promise.all(resultado.empleadosConTardanza.map(async empleadoId => {
            try {
                await SancionService.checkAndApplyAlerts(empleadoId)
            } catch (error) {
                console.error(`Error verificando alertas para empleado ${empleadoId}:`, error)
            }
        }))

        // Evento de dominio
        if (resultado.importados > 0) {
            eventBus.emit('fichadas:imported', { importados: resultado.importados, errores: errores.length })
            
            // AUTO-DETECCIÓN DE AUSENCIAS PARA LOS DÍAS IMPORTADOS (SOLO DÍAS PASADOS)
            // El reporte del local abarca sólo su propio reloj, por lo que no debe inferir
            // ausencias del resto del personal a partir de una nómina parcial.
            const esReporteLocal = registros.some(registro => registro.fuente === 'local_xls')
            try {
                const fechasUnicas = [...new Set(registros.map(r => r.fechaHora.split('T')[0]))]
                const hoyStr = fechaClaveRRHH(new Date())

                if (!esReporteLocal) {
                    await Promise.all(fechasUnicas
                        .filter(fecha => fecha < hoyStr)
                        .map(fecha => this.procesarAusenciasAutomaticas(fecha)))
                }
            } catch (autoErr) {
                console.error('Error en auto-detección de ausencias tras importación:', autoErr)
            }
        }
 
        return {
            success: true,
            importados: resultado.importados,
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
                const clave = fechaClaveRRHH(fecha)
                const plan = await cargarPlanHorarios([emp.id], clave, clave)
                const horario = resolverHorarioPlanificado(plan, emp.id, clave)
                const mins = horario ? minutosTardanzaHorario(fecha, horario) : this.calcularTardanza(fecha, emp.horarioEntrada, emp.turno)
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
        const plan = await cargarPlanHorarios(empleadosActivos.map(e => e.id), fecha, fecha)

        const targetDate = new Date(`${fecha}T12:00:00Z`)
        const dayOfWeek = targetDate.getUTCDay() // 0: Domingo, 6: Sábado

        return empleadosActivos.filter(e => {
            const horario = resolverHorarioPlanificado(plan, e.id, fecha)
            if (horario?.esFranco) return false
            if (horario) return !idsConFichada.has(e.id)
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
