import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'

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

    // ─── Importación Masiva con Idempotencia ─────────────────────────────────
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

        // Obtener mapa de código biométrico → empleadoId
        const empleados = await prisma.empleado.findMany({
            where: { codigoBiometrico: { not: null } },
            select: { id: true, codigoBiometrico: true }
        })

        // Normalizamos: "00011" -> "11"
        const mapEmpleados = new Map(empleados.map(e => {
            const raw = e.codigoBiometrico || ""
            const normalized = raw.replace(/^0+/, '')
            return [normalized, e.id]
        }))

        for (const reg of registros) {
            const regRaw = reg.codigoBiometrico?.toString() || ""
            const regNormalized = regRaw.replace(/^0+/, '')

            const empleadoId = mapEmpleados.get(regNormalized)

            if (!empleadoId) {
                errores.push(`No se encontró empleado con código biométrico: ${regRaw} (Normalizado: ${regNormalized})`)
                continue
            }

            try {
                const fecha = new Date(reg.fechaHora)

                // Idempotencia: verificar si ya existe un registro idéntico
                const existe = await prisma.fichadaEmpleado.findFirst({
                    where: {
                        empleadoId,
                        fechaHora: fecha,
                        tipo: reg.tipo.toLowerCase()
                    }
                })

                if (!existe) {
                    await prisma.fichadaEmpleado.create({
                        data: {
                            empleadoId,
                            fechaHora: fecha,
                            tipo: reg.tipo.toLowerCase(),
                            origen: 'importado'
                        }
                    })
                    importados++
                }
            } catch (err: any) {
                errores.push(`Error al insertar registro para empleado ${empleadoId}: ${err.message}`)
            }
        }

        // Evento de dominio
        if (importados > 0) {
            eventBus.emit('fichadas:imported', { importados, errores: errores.length })
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
            const startDate = new Date(`${params.mes}-01T00:00:00.000Z`)
            const endDate = new Date(startDate)
            endDate.setMonth(endDate.getMonth() + 1)

            where.fechaHora = {
                gte: startDate,
                lt: endDate
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

        const fichada = await prisma.fichadaEmpleado.create({
            data: {
                empleadoId: params.empleadoId,
                fechaHora: new Date(params.fechaHora),
                tipo: params.tipo,
                origen: params.origen || 'manual',
                tipoLicenciaId: params.tipoLicenciaId || null
            }
        })

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
        const startDate = new Date(`${fecha}T00:00:00`)
        const endDate = new Date(`${fecha}T23:59:59`)

        // Empleados activos
        const empleadosActivos = await prisma.empleado.findMany({
            where: { activo: true },
            select: { 
                id: true, 
                nombre: true, 
                apellido: true, 
                horarioEntrada: true,
                turno: { select: { horaInicio: true } }
            }
        })

        // Empleados con fichadas ese día
        const fichadasDelDia = await prisma.fichadaEmpleado.findMany({
            where: {
                fechaHora: { gte: startDate, lte: endDate }
            },
            select: { empleadoId: true }
        })

        const idsConFichada = new Set(fichadasDelDia.map(f => f.empleadoId))

        // Los que no tienen fichada, y que tienen un horario esperado
        return empleadosActivos.filter(e => {
            const tieneHorario = e.turno?.horaInicio || e.horarioEntrada
            return !idsConFichada.has(e.id) && tieneHorario
        })
    }
}
