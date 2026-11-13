import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { fechaClaveRRHH, rangoDiaRRHH } from '@/lib/rrhh/fechas'
import { accionPermitida, estadoFichadoRemoto, ORIGEN_FICHADO_REMOTO, tipoParaAccionRemota, type AccionFichadoRemoto } from '@/lib/rrhh/fichado-remoto'
import { cargarPlanHorarios } from '@/lib/services/horarios-empleado.service'
import { resolverHorarioPlanificado, minutosTardanzaHorario } from '@/lib/rrhh/horarios'
import { AsistenciaService } from '@/lib/services/asistencia.service'
import { configurarJornadaRemota, resumirJornadaRemota } from '@/lib/rrhh/resumen-jornada-remota'

export class FichadoRemotoError extends Error {
    constructor(message: string, readonly status: number) { super(message) }
}

async function empleadoHabilitado(empleadoId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
    const empleado = await db.empleado.findUnique({
        where: { id: empleadoId },
        select: { id: true, nombre: true, activo: true, fichadoRemotoHabilitado: true, horarioEntrada: true, horarioSalida: true, horasTrabajoDiarias: true, horasTrabajoSabado: true, turno: true },
    })
    if (!empleado?.activo || !empleado.fichadoRemotoHabilitado) {
        throw new FichadoRemotoError('El fichado remoto no está habilitado para tu cuenta.', 403)
    }
    return empleado
}

export async function consultarFichadoRemoto(empleadoId: string) {
    const empleado = await empleadoHabilitado(empleadoId)
    const fecha = fechaClaveRRHH(new Date())
    const marcas = await prisma.fichadaEmpleado.findMany({
        where: { empleadoId, fechaHora: rangoDiaRRHH(fecha) },
        orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, fechaHora: true, tipo: true, origen: true },
    })
    const plan = await cargarPlanHorarios([empleadoId], fecha, fecha)
    const horario = resolverHorarioPlanificado(plan, empleadoId, fecha)
    const { horasEsperadas, horarioPrevisto, horarioEntradaComputable } = configurarJornadaRemota(empleado, horario, fecha)
    const ahoraServidor = new Date()
    const resumen = resumirJornadaRemota(marcas, ahoraServidor, horasEsperadas, horarioEntradaComputable)
    return {
        fecha, nombre: empleado.nombre, estado: estadoFichadoRemoto(marcas), marcas,
        horasEfectivas: resumen.minutosEfectivosConfirmados / 60,
        horasEsperadas, horarioPrevisto, horarioEntradaComputable,
        ahoraServidor: ahoraServidor.toISOString(),
    }
}

export async function registrarFichadoRemoto(empleadoId: string, accion: AccionFichadoRemoto) {
    return prisma.$transaction(async tx => {
        // La misma cerradura que usa la importación evita estados cruzados con el reloj.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('fichadas:importar'))::text AS lock_result`
        const empleado = await empleadoHabilitado(empleadoId, tx)
        const ahora = new Date()
        const fecha = fechaClaveRRHH(ahora)
        const existentes = await tx.fichadaEmpleado.findMany({
            where: { empleadoId, fechaHora: rangoDiaRRHH(fecha) },
            orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }],
            select: { tipo: true, origen: true, fechaHora: true },
        })
        const estado = estadoFichadoRemoto(existentes)
        if (!accionPermitida(estado, accion)) {
            throw new FichadoRemotoError('La acción no corresponde al estado actual de la jornada. Actualizá la pantalla.', 409)
        }

        const marca = await tx.fichadaEmpleado.create({ data: {
            empleadoId,
            fechaHora: ahora,
            tipo: tipoParaAccionRemota(accion),
            origen: ORIGEN_FICHADO_REMOTO[accion],
        } })

        if (accion === 'entrada' && existentes.length === 0) {
            const plan = await cargarPlanHorarios([empleadoId], fecha, fecha, tx)
            const horario = resolverHorarioPlanificado(plan, empleadoId, fecha)
            const minutos = horario
                ? minutosTardanzaHorario(ahora, horario)
                : AsistenciaService.calcularTardanza(ahora, empleado.horarioEntrada, empleado.turno)
            if (minutos > 0) {
                const tardanzaExistente = await tx.inasistencia.findFirst({
                    where: { empleadoId, tipo: 'TARDANZA', fecha: rangoDiaRRHH(fecha) },
                    select: { id: true },
                })
                if (!tardanzaExistente) await tx.inasistencia.create({ data: {
                    empleadoId,
                    fecha: ahora,
                    tipo: 'TARDANZA',
                    minutosRetraso: minutos,
                    observaciones: `Llegada tarde detectada al fichar remotamente (${minutos} min de retraso).`,
                } })
            }
        }
        return { marca, estado: estadoFichadoRemoto([...existentes, marca]) }
    }, { maxWait: 10_000, timeout: 30_000 })
}
