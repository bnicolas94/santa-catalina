import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH, instanteRRHH, rangoDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'
import { validarHorarioEsperado, type DiaPlantillaHorario } from '@/lib/rrhh/horarios'
import { rangoHistoricoLiquidacion } from '@/lib/payroll/liquidaciones'

export async function cargarPlanHorarios(empleadoIds: string[], desde: string, hasta: string) {
    const rango = rangoDiasRRHH(desde, hasta)
    const [plantillas, excepciones] = await Promise.all([
        prisma.plantillaHorarioEmpleado.findMany({ where: { empleadoId: { in: empleadoIds }, vigenciaDesde: { lt: rango.lt } } }),
        prisma.excepcionHorarioEmpleado.findMany({ where: { empleadoId: { in: empleadoIds }, fecha: rango } }),
    ])
    return { plantillas, excepciones }
}

export async function guardarPlanHorario(data: Record<string, unknown>, usuarioId: string) {
    const empleadoId = typeof data.empleadoId === 'string' ? data.empleadoId : ''
    if (!empleadoId) throw new Error('Seleccioná un empleado.')
    const esPlantilla = data.modo === 'plantilla'
    if (!esPlantilla && data.modo !== 'fecha') throw new Error('Tipo de planificación inválido.')
    const fecha = validarFechaCivilRRHH(String(esPlantilla ? data.desde : data.fecha))
    if (esPlantilla && fecha < fechaClaveRRHH(new Date())) throw new Error('La plantilla debe comenzar hoy o en una fecha futura. Para días anteriores usá una excepción por fecha.')

    let dias: DiaPlantillaHorario[] = []
    let detalle: Prisma.InputJsonObject = {}
    if (esPlantilla) {
        if (!Array.isArray(data.dias) || data.dias.length > 7) throw new Error('La plantilla admite hasta siete días.')
        dias = data.dias.map(valor => {
            const dia = valor as Record<string, unknown>
            const diaSemana = Number(dia.diaSemana)
            if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) throw new Error('Día de semana inválido.')
            return { diaSemana, ...validarHorarioEsperado(dia) }
        })
        if (new Set(dias.map(dia => dia.diaSemana)).size !== dias.length) throw new Error('Hay días repetidos.')
    } else if (data.horario !== null) {
        detalle = { ...validarHorarioEsperado(data.horario) }
    }

    return prisma.$transaction(async tx => {
        const lock = `horario-empleado:${empleadoId}`
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lock}))::text AS lock_result`
        const empleado = await tx.empleado.findUnique({ where: { id: empleadoId }, select: { activo: true } })
        if (!empleado?.activo) throw new Error('El empleado no está activo.')
        const pagadas = await tx.liquidacionSueldo.findMany({
            where: { empleadoId, estado: 'pagado' },
            select: { periodo: true, desglose: true, periodoDesde: true, periodoHasta: true },
        })
        const bloqueado = pagadas.some(pago => {
            const rango = pago.periodoDesde && pago.periodoHasta
                ? { desde: fechaClaveRRHH(pago.periodoDesde), hasta: fechaClaveRRHH(pago.periodoHasta) }
                : rangoHistoricoLiquidacion(pago.periodo, pago.desglose)
            return rango && (esPlantilla ? rango.hasta >= fecha : rango.desde <= fecha && rango.hasta >= fecha)
        })
        const cerrado = await tx.seguimientoDiarioMixto.findFirst({
            where: { empleadoId, fecha: esPlantilla ? { gte: instanteRRHH(fecha) } : instanteRRHH(fecha), cierreMensualId: { not: null } },
            select: { id: true },
        })
        if (bloqueado || cerrado) throw new Error('No se puede cambiar el horario de un período liquidado o cerrado.')
        if (esPlantilla) {
            // Las versiones previas permanecen intactas; la nueva vigencia no cambia días anteriores.
            return tx.plantillaHorarioEmpleado.upsert({
                where: { empleadoId_vigenciaDesde: { empleadoId, vigenciaDesde: instanteRRHH(fecha) } },
                create: { empleadoId, vigenciaDesde: instanteRRHH(fecha), dias: dias as unknown as Prisma.InputJsonArray, registradoPor: usuarioId },
                update: { dias: dias as unknown as Prisma.InputJsonArray, registradoPor: usuarioId },
            })
        }
        return tx.excepcionHorarioEmpleado.upsert({
            where: { empleadoId_fecha: { empleadoId, fecha: instanteRRHH(fecha) } },
            create: { empleadoId, fecha: instanteRRHH(fecha), detalle, registradoPor: usuarioId },
            update: { detalle, registradoPor: usuarioId },
        })
    }, { timeout: 30_000 })
}
