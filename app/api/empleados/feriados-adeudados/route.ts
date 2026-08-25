import { NextResponse } from 'next/server'

import { eventBus } from '@/lib/events'
import {
    buscarDiaLiquidado,
    calcularAdicionalFeriadoAdeudado,
    periodoFeriadoAdeudado,
    TIPO_FERIADO_ADEUDADO,
} from '@/lib/payroll/feriadosAdeudados'
import { etiquetaSemanaOrigen, semanaLaboralDeOrigen } from '@/lib/payroll/horasExtrasAdeudadas'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH, instanteRRHH, rangoDiaRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'
import { CajaService } from '@/lib/services/caja.service'

function mensajeError(error: unknown) {
    return error instanceof Error ? error.message : 'No se pudo procesar el feriado adeudado.'
}

async function buscarFeriado(fecha: string) {
    const rango = rangoDiaRRHH(fecha)
    return prisma.feriado.findFirst({
        where: { fecha: { gte: rango.gte, lt: rango.lt } },
        select: { id: true, nombre: true, fecha: true },
    })
}

export async function GET(request: Request) {
    try {
        const fechaInformada = new URL(request.url).searchParams.get('fecha')
        const fecha = fechaInformada ? validarFechaCivilRRHH(fechaInformada) : null
        const rango = fecha ? rangoDiaRRHH(fecha) : null

        const [historial, feriado, liquidacionesOriginales, complementosFecha] = await Promise.all([
            prisma.liquidacionSueldo.findMany({
                where: { tipo: TIPO_FERIADO_ADEUDADO, estado: { in: ['pagado', 'anulado'] } },
                include: {
                    empleado: { select: { nombre: true, apellido: true, dni: true, activo: true } },
                    movimientosCaja: {
                        where: { movimientoReversaDeId: null },
                        select: { id: true, cajaOrigen: true },
                    },
                },
                orderBy: { fechaGeneracion: 'desc' },
                take: 200,
            }),
            fecha ? buscarFeriado(fecha) : Promise.resolve(null),
            rango ? prisma.liquidacionSueldo.findMany({
                where: {
                    tipo: 'NORMAL',
                    estado: 'pagado',
                    periodoDesde: { lte: rango.gte },
                    periodoHasta: { gte: rango.gte },
                },
                include: {
                    empleado: {
                        select: {
                            id: true,
                            nombre: true,
                            apellido: true,
                            dni: true,
                            activo: true,
                            horasTrabajoDiarias: true,
                        },
                    },
                },
                orderBy: { fechaGeneracion: 'desc' },
            }) : Promise.resolve([]),
            rango ? prisma.liquidacionSueldo.findMany({
                where: {
                    tipo: TIPO_FERIADO_ADEUDADO,
                    estado: 'pagado',
                    periodoDesde: { gte: rango.gte, lt: rango.lt },
                },
                select: { empleadoId: true, id: true },
            }) : Promise.resolve([]),
        ])

        const yaPagados = new Map(complementosFecha.map(liquidacion => [liquidacion.empleadoId, liquidacion.id]))
        const candidatosPorEmpleado = new Map<string, {
            empleadoId: string
            empleadoNombre: string
            empleadoDni: string | null
            empleadoActivo: boolean
            horas: number
            monto: number
            liquidacionOriginalId: string
            estado: 'DISPONIBLE' | 'YA_INCLUIDO' | 'YA_PAGADO'
            motivo: string | null
        }>()

        if (fecha) {
            for (const liquidacion of liquidacionesOriginales) {
                if (candidatosPorEmpleado.has(liquidacion.empleadoId)) continue
                const dia = buscarDiaLiquidado(liquidacion.desglose, fecha)
                if (!dia || Number(dia.horasTrabajadas) <= 0) continue

                const empleadoNombre = `${liquidacion.empleado.nombre} ${liquidacion.empleado.apellido || ''}`.trim()
                const complementoId = yaPagados.get(liquidacion.empleadoId)
                const yaIncluido = Number(dia.valorFeriado) > 0
                let monto = 0
                if (!yaIncluido && !complementoId) monto = calcularAdicionalFeriadoAdeudado(dia)

                candidatosPorEmpleado.set(liquidacion.empleadoId, {
                    empleadoId: liquidacion.empleadoId,
                    empleadoNombre,
                    empleadoDni: liquidacion.empleado.dni,
                    empleadoActivo: liquidacion.empleado.activo,
                    horas: liquidacion.empleado.horasTrabajoDiarias || Number(dia.horasTrabajadas) || 0,
                    monto,
                    liquidacionOriginalId: liquidacion.id,
                    estado: complementoId ? 'YA_PAGADO' : yaIncluido ? 'YA_INCLUIDO' : 'DISPONIBLE',
                    motivo: complementoId
                        ? 'El complemento de este feriado ya fue pagado.'
                        : yaIncluido
                            ? 'El feriado ya figura abonado en la liquidación semanal.'
                            : null,
                })
            }
        }

        return NextResponse.json({
            feriado: feriado ? {
                id: feriado.id,
                nombre: feriado.nombre,
                fecha: fechaClaveRRHH(feriado.fecha),
            } : null,
            candidatos: [...candidatosPorEmpleado.values()].sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre, 'es')),
            historial: historial.map(liquidacion => {
                const desglose = liquidacion.desglose && typeof liquidacion.desglose === 'object' && !Array.isArray(liquidacion.desglose)
                    ? liquidacion.desglose as Record<string, unknown>
                    : {}
                return {
                    liquidacionId: liquidacion.id,
                    empleadoId: liquidacion.empleadoId,
                    empleadoNombre: `${liquidacion.empleado.nombre} ${liquidacion.empleado.apellido || ''}`.trim(),
                    empleadoDni: liquidacion.empleado.dni,
                    empleadoActivo: liquidacion.empleado.activo,
                    fechaFeriado: String(desglose.fechaFeriado || ''),
                    nombreFeriado: String(desglose.nombreFeriado || 'Feriado'),
                    semanaOrigen: String(desglose.semanaOrigen || liquidacion.periodo),
                    cantidadHoras: liquidacion.horasFeriado,
                    monto: liquidacion.totalNeto,
                    fechaPago: liquidacion.fechaGeneracion,
                    estado: liquidacion.estado,
                    movimientoCaja: liquidacion.movimientosCaja[0] || null,
                }
            }),
        })
    } catch (error) {
        console.error('Error obteniendo feriados adeudados:', error)
        return NextResponse.json({ error: mensajeError(error) }, { status: 400 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const fecha = validarFechaCivilRRHH(typeof body.fecha === 'string' ? body.fecha : '')
        const cajaId = typeof body.cajaId === 'string' ? body.cajaId : ''
        const empleadoIds = Array.isArray(body.empleadoIds)
            ? [...new Set(body.empleadoIds.filter((id): id is string => typeof id === 'string' && Boolean(id)))]
            : []

        if (!cajaId || empleadoIds.length === 0) {
            return NextResponse.json({ error: 'Seleccioná al menos un empleado y una caja de pago.' }, { status: 400 })
        }

        const feriado = await buscarFeriado(fecha)
        if (!feriado) {
            return NextResponse.json({ error: 'La fecha seleccionada no está registrada como feriado en RR. HH.' }, { status: 400 })
        }

        const rango = rangoDiaRRHH(fecha)
        const semana = semanaLaboralDeOrigen(fecha)
        const semanaOrigen = etiquetaSemanaOrigen(fecha)

        const creadas = await prisma.$transaction(async tx => {
            const caja = await tx.saldoCaja.findUnique({ where: { tipo: cajaId } })
            if (!caja) throw new Error(`La caja '${cajaId}' no existe en el sistema.`)

            const resultados = []
            for (const empleadoId of empleadoIds) {
                const lockKey = `feriado-adeudado:${empleadoId}:${fecha}`
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

                const duplicado = await tx.liquidacionSueldo.findFirst({
                    where: {
                        empleadoId,
                        tipo: TIPO_FERIADO_ADEUDADO,
                        estado: 'pagado',
                        periodoDesde: { gte: rango.gte, lt: rango.lt },
                    },
                    select: { id: true },
                })
                if (duplicado) throw new Error('Uno de los empleados seleccionados ya cobró este feriado.')

                const originales = await tx.liquidacionSueldo.findMany({
                    where: {
                        empleadoId,
                        tipo: 'NORMAL',
                        estado: 'pagado',
                        periodoDesde: { lte: rango.gte },
                        periodoHasta: { gte: rango.gte },
                    },
                    include: { empleado: true },
                    orderBy: { fechaGeneracion: 'desc' },
                })
                const original = originales.find(liquidacion => Boolean(buscarDiaLiquidado(liquidacion.desglose, fecha)))
                if (!original) throw new Error('No se encontró la liquidación semanal original de uno de los empleados.')

                const dia = buscarDiaLiquidado(original.desglose, fecha)
                if (!dia) throw new Error('La liquidación original no contiene el día seleccionado.')
                const monto = calcularAdicionalFeriadoAdeudado(dia)
                const cantidadHoras = original.empleado.horasTrabajoDiarias || Number(dia.horasTrabajadas) || 0
                const nombreEmpleado = `${original.empleado.nombre} ${original.empleado.apellido || ''}`.trim()

                const liquidacion = await tx.liquidacionSueldo.create({
                    data: {
                        empleadoId,
                        periodo: periodoFeriadoAdeudado(fecha, feriado.nombre),
                        periodoDesde: instanteRRHH(fecha),
                        periodoHasta: instanteRRHH(fecha),
                        registradaEnCaja: true,
                        sueldoProporcional: 0,
                        horasNormales: 0,
                        montoHorasNormales: 0,
                        horasExtras: 0,
                        montoHorasExtras: 0,
                        horasFeriado: cantidadHoras,
                        montoHorasFeriado: monto,
                        descuentosPrestamos: 0,
                        totalNeto: monto,
                        estado: 'pagado',
                        tipo: TIPO_FERIADO_ADEUDADO,
                        desglose: {
                            origen: TIPO_FERIADO_ADEUDADO,
                            fechaFeriado: fecha,
                            nombreFeriado: feriado.nombre,
                            semanaOrigen,
                            semanaDesde: semana.desde,
                            semanaHasta: semana.hasta,
                            liquidacionOriginalId: original.id,
                            cantidadHoras,
                            monto,
                            valorHoraFeriado: cantidadHoras > 0 ? monto / cantidadHoras : 0,
                        },
                    },
                })

                await CajaService.createMovimientoEnTx(tx, {
                    tipo: 'egreso',
                    concepto: 'pago_feriado_adeudado',
                    monto,
                    cajaOrigen: cajaId,
                    liquidacionSueldoId: liquidacion.id,
                    descripcion: `Feriado adeudado: ${nombreEmpleado} - ${feriado.nombre} (${fecha}) (ID: ${liquidacion.id})`,
                })

                resultados.push({
                    ...liquidacion,
                    empleadoNombre: nombreEmpleado,
                    empleadoDni: original.empleado.dni,
                    nombreFeriado: feriado.nombre,
                    fechaFeriado: fecha,
                    semanaOrigen,
                })
            }
            return resultados
        }, { timeout: 20_000 })

        creadas.forEach(liquidacion => eventBus.emit('liquidacion:created', {
            liquidacionId: liquidacion.id,
            empleadoId: liquidacion.empleadoId,
            monto: liquidacion.totalNeto,
        }))

        return NextResponse.json({ liquidaciones: creadas }, { status: 201 })
    } catch (error) {
        console.error('Error pagando feriados adeudados:', error)
        return NextResponse.json({ error: mensajeError(error) }, { status: 400 })
    }
}
