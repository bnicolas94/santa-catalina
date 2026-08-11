import type { Prisma } from '@prisma/client'
import { CajaService } from '@/lib/services/caja.service'
import { estadoPagoDesdeMontos, type PagoCajaInput } from '@/lib/compras/validacion'

type TxClient = Prisma.TransactionClient

type RegistrarPagoInput = {
    compraId: string
    monto: number
    pagos: PagoCajaInput[]
    fecha: Date
    descripcion: string
    ubicacionId?: string | null
}

export class ComprasService {
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

    static async recalcularCompraEnTx(tx: TxClient, compraId: string) {
        const movimientos = await tx.movimientoStock.findMany({
            where: { compraId, tipo: 'entrada' },
            select: { costoTotal: true, montoPagado: true },
        })
        const costoTotal = movimientos.reduce((acc, mov) => acc + (mov.costoTotal || 0), 0)
        const montoPagado = movimientos.reduce((acc, mov) => acc + (mov.montoPagado || 0), 0)
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
