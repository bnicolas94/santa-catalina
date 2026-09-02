import type { Prisma } from '@prisma/client'
import { CajaService } from '@/lib/services/caja.service'
import {
    CompraValidationError,
    distribuirMontoPagadoPorCostos,
    estadoPagoDesdeMontos,
    validarMontoPagado,
    type PagoCajaInput,
} from '@/lib/compras/validacion'

type TxClient = Prisma.TransactionClient

type RegistrarPagoInput = {
    compraId: string
    monto: number
    pagos: PagoCajaInput[]
    fecha: Date
    descripcion: string
    ubicacionId?: string | null
}

type StockCompraInput = {
    insumoId: string
    ubicacionId: string | null
    cantidad: number
    cantidadSecundaria?: number | null
}

type PagarCompraInput = {
    compraId: string
    monto: number
    cajaOrigen: string
    fecha: Date
}

export class ComprasService {
    static async aplicarStockEnTx(tx: TxClient, input: StockCompraInput, factor: 1 | -1) {
        const delta = factor * input.cantidad
        const deltaSecundario = factor * (input.cantidadSecundaria || 0)

        await tx.insumo.update({
            where: { id: input.insumoId },
            data: {
                stockActual: { increment: delta },
                stockActualSecundario: { increment: deltaSecundario },
            },
        })

        if (input.ubicacionId) {
            await tx.stockInsumo.upsert({
                where: {
                    insumoId_ubicacionId: {
                        insumoId: input.insumoId,
                        ubicacionId: input.ubicacionId,
                    },
                },
                update: {
                    cantidad: { increment: delta },
                    cantidadSecundaria: { increment: deltaSecundario },
                },
                create: {
                    insumoId: input.insumoId,
                    ubicacionId: input.ubicacionId,
                    cantidad: delta,
                    cantidadSecundaria: deltaSecundario,
                },
            })
        }
    }

    static async registrarPagoEnTx(tx: TxClient, input: RegistrarPagoInput) {
        let categoria = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
        if (!categoria) {
            categoria = await tx.categoriaGasto.create({
                data: { nombre: 'Proveedores', color: '#3498DB' },
            })
        }

        const gasto = await tx.gastoOperativo.create({
            data: {
                fecha: input.fecha,
                monto: input.monto,
                descripcion: input.descripcion,
                categoriaId: categoria.id,
                compraId: input.compraId,
                tipoRegistro: 'pago_proveedor',
                ubicacionId: input.ubicacionId || null,
            },
        })

        for (const pago of input.pagos) {
            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: 'pago_proveedor',
                monto: pago.monto,
                medioPago: pago.cajaOrigen.includes('mercado_pago') ? 'transferencia' : 'efectivo',
                cajaOrigen: pago.cajaOrigen,
                descripcion: input.descripcion,
                gastoId: gasto.id,
                fecha: input.fecha,
            })
        }

        return gasto
    }

    static async pagarCompraEnTx(tx: TxClient, input: PagarCompraInput) {
        const compra = await tx.compra.findUnique({
            where: { id: input.compraId },
            include: {
                proveedor: { select: { nombre: true } },
                movimientosStock: {
                    where: { tipo: 'entrada' },
                    select: { id: true, costoTotal: true },
                },
            },
        })
        if (!compra) throw new CompraValidationError('Compra no encontrada')
        if (compra.costoTotal <= 0) throw new CompraValidationError('La compra no tiene un total registrado')

        const saldoPendiente = compra.costoTotal - compra.montoPagado
        if (saldoPendiente <= 0.01) throw new CompraValidationError('La compra ya está totalmente pagada')
        if (input.monto <= 0) throw new CompraValidationError('El monto a pagar debe ser mayor a 0')
        validarMontoPagado(saldoPendiente, input.monto)

        const nuevoMontoPagado = compra.montoPagado + input.monto
        const nuevoEstado = estadoPagoDesdeMontos(compra.costoTotal, nuevoMontoPagado)

        await this.registrarPagoEnTx(tx, {
            compraId: compra.id,
            monto: input.monto,
            pagos: [{ cajaOrigen: input.cajaOrigen, monto: input.monto }],
            fecha: input.fecha,
            ubicacionId: compra.ubicacionId,
            descripcion: nuevoEstado === 'pagado'
                ? `Pago final de compra${compra.numeroFactura ? ` Fac. ${compra.numeroFactura}` : ''} - ${compra.proveedor?.nombre || 'General'}`
                : `Pago a cuenta de compra${compra.numeroFactura ? ` Fac. ${compra.numeroFactura}` : ''} - ${compra.proveedor?.nombre || 'General'}`,
        })

        const montosStock = distribuirMontoPagadoPorCostos(
            compra.movimientosStock.map(item => item.costoTotal || 0),
            nuevoMontoPagado,
            compra.costoTotal
        )
        for (let index = 0; index < compra.movimientosStock.length; index += 1) {
            await tx.movimientoStock.update({
                where: { id: compra.movimientosStock[index].id },
                data: { montoPagado: montosStock[index], estadoPago: nuevoEstado },
            })
        }

        return tx.compra.update({
            where: { id: compra.id },
            data: { montoPagado: nuevoMontoPagado, estadoPago: nuevoEstado },
        })
    }

    static async recalcularCompraEnTx(tx: TxClient, compraId: string) {
        const [compra, movimientos, gastosFactura] = await Promise.all([
            tx.compra.findUnique({ where: { id: compraId }, select: { montoPagado: true } }),
            tx.movimientoStock.findMany({
                where: { compraId, tipo: 'entrada' },
                select: { costoTotal: true },
            }),
            tx.gastoOperativo.aggregate({
                where: { compraId, tipoRegistro: 'concepto_compra' },
                _sum: { monto: true },
            }),
        ])
        if (!compra) throw new CompraValidationError('Compra no encontrada')
        const costoTotal = movimientos.reduce((acc, mov) => acc + (mov.costoTotal || 0), 0)
            + (gastosFactura._sum.monto || 0)
        const montoPagado = compra.montoPagado
        const estadoPago = estadoPagoDesdeMontos(costoTotal, montoPagado)

        return tx.compra.update({
            where: { id: compraId },
            data: { costoTotal, montoPagado, estadoPago },
        })
    }

    static async revertirFinanzasCompraEnTx(tx: TxClient, compraId: string) {
        const gastos = await tx.gastoOperativo.findMany({
            where: { compraId },
            include: { movimientosCaja: { select: { id: true } } },
        })

        for (const gasto of gastos) {
            for (const movimiento of gasto.movimientosCaja) {
                await CajaService.revertirMovimientoEnTx(tx, movimiento.id)
            }
        }

        const gastoIds = gastos.map(gasto => gasto.id)
        if (gastoIds.length > 0) {
            await tx.movimientoStock.updateMany({
                where: { gastoId: { in: gastoIds } },
                data: { gastoId: null },
            })
            await tx.gastoOperativo.deleteMany({ where: { id: { in: gastoIds } } })
        }
    }
}
