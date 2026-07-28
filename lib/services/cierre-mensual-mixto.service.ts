import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
    calcularDistribucionMixta,
    estadoCierreDesdePagos,
    MODALIDAD_MENSUAL_MIXTA,
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

async function liquidacionesSemanalesSuperpuestas(empleadoId: string, periodo: string) {
    const rango = rangoMesLiquidacion(periodo)
    const liquidaciones = await prisma.liquidacionSueldo.findMany({
        where: { empleadoId, tipo: 'NORMAL', estado: 'pagado' },
        select: {
            id: true,
            periodo: true,
            totalNeto: true,
            periodoDesde: true,
            periodoHasta: true,
            desglose: true,
        },
    })
    return liquidaciones.filter(liquidacion => {
        const rangoLiquidacion = liquidacion.periodoDesde && liquidacion.periodoHasta
            ? {
                desde: fechaClaveRRHH(liquidacion.periodoDesde),
                hasta: fechaClaveRRHH(liquidacion.periodoHasta),
            }
            : rangoHistoricoLiquidacion(liquidacion.periodo, liquidacion.desglose)
        return rangoLiquidacion ? rangosLiquidacionSeSuperponen(rango, rangoLiquidacion) : false
    })
}

export class CierreMensualMixtoService {
    static async obtener(periodo: string) {
        const rango = rangoMesLiquidacion(periodo)
        const empleados = await prisma.empleado.findMany({
            where: { activo: true, modalidadPago: MODALIDAD_MENSUAL_MIXTA },
            select: { id: true, nombre: true, apellido: true, dni: true },
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
                liquidacionesSemanalesSuperpuestas(empleado.id, periodo),
            ])
            return {
                empleado,
                periodo,
                rango,
                totalCalculado: cierre?.totalDevengado ?? resumen?.totalNeto ?? 0,
                resumen,
                cierre,
                referenciasSemanales: {
                    cantidad: referencias.length,
                    total: referencias.reduce((total, liquidacion) => total + liquidacion.totalNeto, 0),
                    liquidaciones: referencias.map(liquidacion => ({
                        id: liquidacion.id,
                        periodo: liquidacion.periodo,
                        totalNeto: liquidacion.totalNeto,
                    })),
                },
            }
        }))
    }

    static async cerrar(input: { empleadoId: string; periodo: string; netoRecibo: unknown }) {
        const rango = rangoMesLiquidacion(input.periodo)
        if (!periodoMensualCerrable(input.periodo, fechaClaveRRHH(new Date()))) {
            throw new Error('El mes todavía no terminó y no puede cerrarse.')
        }
        const empleado = await prisma.empleado.findUnique({
            where: { id: input.empleadoId },
            select: { id: true, nombre: true, apellido: true, activo: true, modalidadPago: true },
        })
        if (!empleado?.activo || empleado.modalidadPago !== MODALIDAD_MENSUAL_MIXTA) {
            throw new Error('La empleada no está activa o no utiliza la modalidad mensual mixta.')
        }

        const referencias = await liquidacionesSemanalesSuperpuestas(empleado.id, input.periodo)
        if (referencias.length > 0) {
            throw new Error(`Existen ${referencias.length} liquidaciones semanales superpuestas. Anulalas o conciliá esos pagos antes de cerrar el mes.`)
        }

        const resumen = await PayrollService.calcularSueldoSemanal(empleado.id, rango.desde, rango.hasta)
        const distribucion = calcularDistribucionMixta(resumen.totalNeto, input.netoRecibo)
        const rangoInstantes = rangoDiasRRHH(rango.desde, rango.hasta)

        return prisma.$transaction(async tx => {
            const lockKey = `liquidacion:${empleado.id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const existente = await tx.cierreMensualMixto.findUnique({
                where: { empleadoId_periodo: { empleadoId: empleado.id, periodo: input.periodo } },
            })
            if (existente) throw new Error('El mes ya tiene un cierre registrado para esta empleada.')

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

            const liquidacion = await tx.liquidacionSueldo.create({
                data: {
                    empleadoId: empleado.id,
                    periodo: `Cierre mensual mixto ${input.periodo}`,
                    periodoDesde: instanteRRHH(rango.desde),
                    periodoHasta: instanteRRHH(rango.hasta),
                    sueldoProporcional: resumen.sueldoBase,
                    horasNormales: resumen.horasNormales,
                    montoHorasNormales: 0,
                    horasExtras: resumen.horasExtras,
                    montoHorasExtras: resumen.montoHorasExtras,
                    horasFeriado: resumen.horasFeriado,
                    montoHorasFeriado: resumen.montoHorasFeriado,
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
                    desglose: resumen.desglosePorDia as unknown as Prisma.InputJsonValue,
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

            const distribucion = calcularDistribucionMixta(cierre.totalDevengado, cierre.netoRecibo)
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
        })
    }
}
