import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
    calcularDistribucionMixta,
    consolidarDevengadoMensual,
    estadoCierreDesdePagos,
    MODALIDAD_MENSUAL_MIXTA,
    montoDevengadoReferenciaEnPeriodo,
    resolverConciliacionSemanal,
    montoPorMedio,
    periodoMensualCerrable,
    rangoMesLiquidacion,
    type MedioPagoMixto,
} from '@/lib/payroll/cierreMensualMixto'
import { rangoHistoricoLiquidacion, rangosLiquidacionSeSuperponen } from '@/lib/payroll/liquidaciones'
import { seleccionarCuotasVencidasPorPrestamo } from '@/lib/payroll/prestamos'
import { fechaClaveRRHH, instanteRRHH, rangoDiasRRHH } from '@/lib/rrhh/fechas'
import { CajaService } from '@/lib/services/caja.service'
import { PayrollService } from '@/lib/services/payroll.service'

type ClienteConciliacion = Pick<Prisma.TransactionClient, 'liquidacionSueldo'>

async function liquidacionesSemanalesSuperpuestas(
    empleadoId: string,
    periodo: string,
    diasTrabajoSemana: string,
    cliente: ClienteConciliacion = prisma,
) {
    const rango = rangoMesLiquidacion(periodo)
    const liquidaciones = await cliente.liquidacionSueldo.findMany({
        where: { empleadoId, tipo: 'NORMAL', estado: 'pagado' },
        select: {
            id: true,
            periodo: true,
            totalNeto: true,
            periodoDesde: true,
            periodoHasta: true,
            desglose: true,
            movimientosCaja: {
                where: { tipo: 'egreso', movimientoReversaDeId: null },
                select: {
                    id: true,
                    monto: true,
                    cajaOrigen: true,
                    movimientoReversion: { select: { id: true } },
                },
            },
        },
    })
    return liquidaciones.flatMap(liquidacion => {
        const rangoLiquidacion = liquidacion.periodoDesde && liquidacion.periodoHasta
            ? {
                desde: fechaClaveRRHH(liquidacion.periodoDesde),
                hasta: fechaClaveRRHH(liquidacion.periodoHasta),
            }
            : rangoHistoricoLiquidacion(liquidacion.periodo, liquidacion.desglose)
        const superpuesta = rangoLiquidacion ? rangosLiquidacionSeSuperponen(rango, rangoLiquidacion) : false
        const movimientosVigentes = liquidacion.movimientosCaja.filter(movimiento => !movimiento.movimientoReversion)
        const montoPagado = Math.round(movimientosVigentes.reduce((total, movimiento) => total + movimiento.monto, 0) * 100) / 100
        if (!superpuesta || !rangoLiquidacion) return []
        const montoDevengadoPeriodo = montoDevengadoReferenciaEnPeriodo({
            id: liquidacion.id,
            totalNeto: liquidacion.totalNeto,
            rango: rangoLiquidacion,
            desglose: liquidacion.desglose,
        }, rango, diasTrabajoSemana)
        return [{
            ...liquidacion,
            rango: rangoLiquidacion,
            movimientosCaja: movimientosVigentes,
            montoPagado,
            montoDevengadoPeriodo,
            cruzaPeriodo: rangoLiquidacion.desde < rango.desde || rangoLiquidacion.hasta > rango.hasta,
        }]
    })
}

export class CierreMensualMixtoService {
    static async obtener(periodo: string) {
        const rango = rangoMesLiquidacion(periodo)
        const empleados = await prisma.empleado.findMany({
            where: { activo: true, modalidadPago: MODALIDAD_MENSUAL_MIXTA },
            select: { id: true, nombre: true, apellido: true, dni: true, diasTrabajoSemana: true },
            orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
        })
        const cierres = await prisma.cierreMensualMixto.findMany({
            where: { periodo, empleadoId: { in: empleados.map(empleado => empleado.id) } },
            include: {
                pagos: {
                    include: { movimientoCaja: { select: { id: true, cajaOrigen: true } } },
                    orderBy: { fechaPago: 'asc' },
                },
                liquidacionSueldo: { select: { id: true, estado: true } },
            },
        })
        const cierrePorEmpleado = new Map(cierres.map(cierre => [cierre.empleadoId, cierre]))

        return Promise.all(empleados.map(async empleado => {
            const cierre = cierrePorEmpleado.get(empleado.id) || null
            const [resumen, referencias] = await Promise.all([
                cierre ? null : PayrollService.calcularSueldoSemanal(empleado.id, rango.desde, rango.hasta),
                liquidacionesSemanalesSuperpuestas(empleado.id, periodo, empleado.diasTrabajoSemana),
            ])
            const consolidado = resumen ? consolidarDevengadoMensual({
                periodo: rango,
                diasActuales: resumen.desglosePorDia,
                descuentoPendiente: resumen.descuentoPrestamos,
                referencias,
            }) : null
            return {
                empleado,
                periodo,
                rango,
                totalCalculado: cierre?.totalDevengado ?? consolidado?.totalDevengado ?? 0,
                consolidado,
                resumen,
                cierre: cierre ? {
                    ...cierre,
                    totalConciliado: Math.max(0, Math.round((cierre.totalDevengado - cierre.netoRecibo - cierre.efectivoCalculado) * 100) / 100),
                } : null,
                referenciasSemanales: {
                    cantidad: referencias.length,
                    cantidadPagadas: referencias.filter(liquidacion => liquidacion.montoPagado > 0).length,
                    total: referencias.reduce((total, liquidacion) => total + liquidacion.montoPagado, 0),
                    totalDevengado: Math.round(referencias.reduce((total, liquidacion) => total + liquidacion.montoDevengadoPeriodo, 0) * 100) / 100,
                    liquidaciones: referencias.map(liquidacion => ({
                        id: liquidacion.id,
                        periodo: liquidacion.periodo,
                        totalNeto: liquidacion.totalNeto,
                        montoPagado: liquidacion.montoPagado,
                        montoDevengadoPeriodo: liquidacion.montoDevengadoPeriodo,
                        cruzaPeriodo: liquidacion.cruzaPeriodo,
                    })),
                },
            }
        }))
    }

    static async cerrar(input: {
        empleadoId: string
        periodo: string
        netoRecibo: unknown
        liquidacionesConciliadas: unknown
        conciliacionConfirmada: unknown
        usuarioId: string
    }) {
        const rango = rangoMesLiquidacion(input.periodo)
        if (!periodoMensualCerrable(input.periodo, fechaClaveRRHH(new Date()))) {
            throw new Error('El mes todavía no terminó y no puede cerrarse.')
        }
        const empleado = await prisma.empleado.findUnique({
            where: { id: input.empleadoId },
            select: { id: true, nombre: true, apellido: true, activo: true, modalidadPago: true, diasTrabajoSemana: true },
        })
        if (!empleado?.activo || empleado.modalidadPago !== MODALIDAD_MENSUAL_MIXTA) {
            throw new Error('La empleada no está activa o no utiliza la modalidad mensual mixta.')
        }

        const resumen = await PayrollService.calcularSueldoSemanal(empleado.id, rango.desde, rango.hasta)
        const rangoInstantes = rangoDiasRRHH(rango.desde, rango.hasta)

        return prisma.$transaction(async tx => {
            const lockKey = `liquidacion:${empleado.id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const existente = await tx.cierreMensualMixto.findUnique({
                where: { empleadoId_periodo: { empleadoId: empleado.id, periodo: input.periodo } },
            })
            if (existente) throw new Error('El mes ya tiene un cierre registrado para esta empleada.')

            const referencias = await liquidacionesSemanalesSuperpuestas(empleado.id, input.periodo, empleado.diasTrabajoSemana, tx)
            if (referencias.length > 0 && input.conciliacionConfirmada !== true) {
                throw new Error('Confirmá que revisaste los pagos semanales antes de cerrar el mes.')
            }
            const conciliacion = resolverConciliacionSemanal(referencias, input.liquidacionesConciliadas)
            const totalConciliado = conciliacion.total
            const consolidado = consolidarDevengadoMensual({
                periodo: rango,
                diasActuales: resumen.desglosePorDia,
                descuentoPendiente: resumen.descuentoPrestamos,
                referencias,
            })
            const distribucion = calcularDistribucionMixta(consolidado.totalDevengado, input.netoRecibo, totalConciliado)

            const cuotasPendientes = await tx.cuotaPrestamo.findMany({
                where: {
                    prestamo: { empleadoId: empleado.id },
                    estado: 'pendiente',
                    liquidacionId: null,
                    fechaVencimiento: { lt: rangoInstantes.lt },
                },
                orderBy: [{ fechaVencimiento: 'asc' }, { numeroCuota: 'asc' }],
            })
            const cuotasAfectadas = seleccionarCuotasVencidasPorPrestamo(cuotasPendientes, rangoInstantes.lt)
            const descuentoActual = cuotasAfectadas.reduce((total, cuota) => total + cuota.monto, 0)
            if (Math.abs(descuentoActual - resumen.descuentoPrestamos) > 0.009) {
                throw new Error('Las cuotas de préstamos cambiaron. Recalculá el cierre antes de confirmarlo.')
            }
            const desgloseCierre = {
                dias: resumen.desglosePorDia,
                consolidacion: {
                    ...consolidado,
                    fuentesSemanales: referencias.map(referencia => ({
                        id: referencia.id,
                        periodo: referencia.periodo,
                        rango: referencia.rango,
                        totalLiquidacion: referencia.totalNeto,
                        montoDevengadoPeriodo: referencia.montoDevengadoPeriodo,
                        cruzaPeriodo: referencia.cruzaPeriodo,
                    })),
                },
                conciliacion: {
                    totalConciliado,
                    registradoPorId: input.usuarioId,
                    registradoAt: new Date().toISOString(),
                    liquidaciones: conciliacion.liquidaciones.map(referencia => ({
                        id: referencia.id,
                        periodo: referencia.periodo,
                        totalLiquidacion: referencia.totalNeto,
                        montoPagado: referencia.montoPagado,
                        montoDevengadoPeriodo: referencia.montoDevengadoPeriodo,
                        montoConciliado: referencia.montoConciliado,
                        movimientosCaja: referencia.movimientosCaja.map(movimiento => ({
                            id: movimiento.id,
                            monto: movimiento.monto,
                            cajaOrigen: movimiento.cajaOrigen,
                        })),
                    })),
                },
            }

            const liquidacion = await tx.liquidacionSueldo.create({
                data: {
                    empleadoId: empleado.id,
                    periodo: `Cierre mensual mixto ${input.periodo}`,
                    periodoDesde: instanteRRHH(rango.desde),
                    periodoHasta: instanteRRHH(rango.hasta),
                    sueldoProporcional: distribucion.totalDevengado + resumen.descuentoPrestamos,
                    horasNormales: 0,
                    montoHorasNormales: 0,
                    horasExtras: 0,
                    montoHorasExtras: 0,
                    horasFeriado: 0,
                    montoHorasFeriado: 0,
                    descuentosPrestamos: resumen.descuentoPrestamos,
                    totalNeto: distribucion.totalDevengado,
                    estado: 'pendiente_pago',
                    tipo: 'MENSUAL_MIXTA',
                    registradaEnCaja: false,
                    desglose: resumen.desglosePorDia as unknown as Prisma.InputJsonValue,
                },
            })

            for (const cuota of cuotasAfectadas) {
                await tx.cuotaPrestamo.update({
                    where: { id: cuota.id },
                    data: { estado: 'pagada', fechaPago: new Date(), liquidacionId: liquidacion.id },
                })
            }

            const cierre = await tx.cierreMensualMixto.create({
                data: {
                    empleadoId: empleado.id,
                    liquidacionSueldoId: liquidacion.id,
                    periodo: input.periodo,
                    periodoDesde: instanteRRHH(rango.desde),
                    periodoHasta: instanteRRHH(rango.hasta),
                    totalDevengado: distribucion.totalDevengado,
                    netoRecibo: distribucion.transferencia,
                    efectivoCalculado: distribucion.efectivo,
                    estado: 'PENDIENTE',
                    desglose: desgloseCierre as unknown as Prisma.InputJsonValue,
                },
                include: { pagos: true, liquidacionSueldo: true, empleado: true },
            })
            await tx.seguimientoDiarioMixto.updateMany({
                where: {
                    empleadoId: empleado.id,
                    fecha: { gte: rangoInstantes.gte, lt: rangoInstantes.lt },
                    cierreMensualId: null,
                },
                data: { cierreMensualId: cierre.id },
            })
            return cierre
        }, {
            // La base de producción es remota y este cierre necesita varias
            // lecturas y escrituras auditables dentro de la misma transacción.
            maxWait: 10_000,
            timeout: 30_000,
        })
    }

    static async pagar(input: {
        cierreId: string
        medio: MedioPagoMixto
        cajaId: string
        usuarioId: string
    }) {
        if (!['TRANSFERENCIA', 'EFECTIVO'].includes(input.medio)) throw new Error('El medio de pago es inválido.')
        if (!input.cajaId) throw new Error('Seleccioná la caja o cuenta de pago.')

        return prisma.$transaction(async tx => {
            const lockKey = `cierre-mensual:${input.cierreId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`
            const cierre = await tx.cierreMensualMixto.findUnique({
                where: { id: input.cierreId },
                include: { pagos: true, empleado: true, liquidacionSueldo: true },
            })
            if (!cierre || cierre.estado === 'ANULADO') throw new Error('El cierre no existe o fue anulado.')
            if (cierre.pagos.some(pago => pago.medio === input.medio && pago.estado !== 'ANULADO')) {
                throw new Error(`El pago por ${input.medio.toLowerCase()} ya fue registrado.`)
            }

            const totalConciliado = Math.max(0, Math.round((cierre.totalDevengado - cierre.netoRecibo - cierre.efectivoCalculado) * 100) / 100)
            const distribucion = calcularDistribucionMixta(cierre.totalDevengado, cierre.netoRecibo, totalConciliado)
            const monto = montoPorMedio(distribucion, input.medio)
            if (monto <= 0) throw new Error(`Este cierre no tiene saldo para pagar por ${input.medio.toLowerCase()}.`)
            const caja = await tx.saldoCaja.findUnique({ where: { tipo: input.cajaId } })
            if (!caja) throw new Error(`La caja '${input.cajaId}' no existe.`)

            const pago = await tx.pagoCierreMensual.create({
                data: {
                    cierreId: cierre.id,
                    medio: input.medio,
                    monto,
                    cajaOrigen: input.cajaId,
                    registradoPorId: input.usuarioId,
                },
            })
            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: input.medio === 'TRANSFERENCIA' ? 'pago_sueldo_transferencia' : 'pago_sueldo_efectivo',
                monto,
                cajaOrigen: input.cajaId,
                medioPago: input.medio === 'TRANSFERENCIA' ? 'transferencia' : 'efectivo',
                liquidacionSueldoId: cierre.liquidacionSueldoId,
                pagoCierreMensualId: pago.id,
                descripcion: `Cierre mensual mixto: ${cierre.empleado.nombre} ${cierre.empleado.apellido || ''} - ${cierre.periodo} - ${input.medio} (ID: ${cierre.liquidacionSueldoId})`,
            })

            const pagosActualizados = [...cierre.pagos, pago]
            const estado = estadoCierreDesdePagos(distribucion, pagosActualizados)
            await tx.cierreMensualMixto.update({ where: { id: cierre.id }, data: { estado } })
            await tx.liquidacionSueldo.update({
                where: { id: cierre.liquidacionSueldoId },
                data: {
                    registradaEnCaja: true,
                    estado: estado === 'PAGADO' ? 'pagado' : 'pendiente_pago',
                },
            })

            return tx.cierreMensualMixto.findUniqueOrThrow({
                where: { id: cierre.id },
                include: {
                    pagos: {
                        include: { movimientoCaja: { select: { id: true, cajaOrigen: true } } },
                        orderBy: { fechaPago: 'asc' },
                    },
                    liquidacionSueldo: true,
                    empleado: true,
                },
            })
        }, {
            // Registrar el egreso, actualizar Caja y cerrar el estado requiere
            // varios viajes a la base remota dentro de una única transacción.
            maxWait: 10_000,
            timeout: 30_000,
        })
    }
}
