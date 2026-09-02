import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    numeroPositivo,
    validarCajaCompra,
} from '@/lib/compras/validacion'

// Compatibilidad con el historial de stock: registra el pago sobre la factura completa.
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        let body: Record<string, unknown> = {}
        try {
            body = await request.json() as Record<string, unknown>
        } catch {
            // Sin monto explícito se cancela todo el saldo pendiente.
        }
        const cajaOrigen = validarCajaCompra(body.cajaOrigen || 'caja_chica')

        const actualizado = await prisma.$transaction(async tx => {
            const movimiento = await tx.movimientoStock.findUnique({
                where: { id },
                select: { id: true, tipo: true, compraId: true },
            })
            if (!movimiento || movimiento.tipo !== 'entrada') {
                throw new CompraValidationError('Movimiento no encontrado o no es una compra')
            }
            if (!movimiento.compraId) {
                throw new CompraValidationError('Las facturas históricas son de solo lectura y no admiten pagos nuevos')
            }

            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'pago-compra:' + movimiento.compraId}))::text AS lock_result`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + movimiento.compraId}))::text AS lock_result`
            const compra = await tx.compra.findUnique({ where: { id: movimiento.compraId } })
            if (!compra) throw new CompraValidationError('Compra no encontrada')
            const saldoPendiente = compra.costoTotal - compra.montoPagado
            const monto = body.monto === undefined || body.monto === null || body.monto === ''
                ? saldoPendiente
                : numeroPositivo(body.monto, 'Monto a pagar')

            await ComprasService.pagarCompraEnTx(tx, {
                compraId: movimiento.compraId,
                monto,
                cajaOrigen,
                fecha: new Date(),
            })

            return tx.movimientoStock.findUnique({
                where: { id },
                include: {
                    insumo: { select: { id: true, nombre: true, unidadMedida: true, unidadSecundaria: true } },
                    proveedor: { select: { id: true, nombre: true } },
                    compra: true,
                },
            })
        })

        return NextResponse.json(actualizado)
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error registrando pago de compra:', error)
        return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
    }
}
