import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { fechaClaveRRHH, rangoDiaRRHH } from '@/lib/rrhh/fechas'
import { accionPermitida, estadoFichadoRemoto, ORIGEN_FICHADO_REMOTO, tipoParaAccionRemota, type AccionFichadoRemoto } from '@/lib/rrhh/fichado-remoto'
import { cargarPlanHorarios } from '@/lib/services/horarios-empleado.service'
import { resolverHorarioPlanificado, minutosTardanzaHorario } from '@/lib/rrhh/horarios'
import { AsistenciaService } from '@/lib/services/asistencia.service'
import { horasJornadaParaFecha } from '@/lib/payroll/jornadaSemanal'
import { calcularResumenDia } from '@/utils/horas'

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
    const diaSemana = new Date(`${fecha}T12:00:00-03:00`).getUTCDay()
    const horasEsperadas = horario && !horario.esFranco
        ? horario.horasEsperadas
        : horasJornadaParaFecha(fecha, empleado.horasTrabajoDiarias, empleado.horasTrabajoSabado)
    const horarioPrevisto = horario?.esFranco ? null : {
        entrada: horario?.horaInicio ?? empleado.turno?.horaInicio ?? empleado.horarioEntrada,
        salida: horario?.horaFin ?? empleado.turno?.horaFin ?? empleado.horarioSalida,
    }
    const resumen = calcularResumenDia(
        marcas.filter(marca => marca.tipo === 'entrada' || marca.tipo === 'salida').map(marca => ({
            fechaHora: marca.fechaHora,
            tipo: marca.tipo as 'entrada' | 'salida',
        })),
        horasEsperadas,
        { horarioEntrada: horario?.esFranco ? null : horario?.horaInicio ?? (diaSemana === 0 ? null : empleado.turno?.horaInicio || empleado.horarioEntrada) },
    )
    return { fecha, nombre: empleado.nombre, estado: estadoFichadoRemoto(marcas), marcas, horasEfectivas: resumen.horasTrabajadas, horasEsperadas, horarioPrevisto }
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
