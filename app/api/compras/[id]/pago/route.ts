import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    numeroPositivo,
    validarCajaCompra,
} from '@/lib/compras/validacion'

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

        const compra = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'pago-compra:' + id}))::text AS lock_result`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + id}))::text AS lock_result`
            const actual = await tx.compra.findUnique({ where: { id } })
            if (!actual) throw new CompraValidationError('Compra no encontrada')
            const saldoPendiente = actual.costoTotal - actual.montoPagado
            const monto = body.monto === undefined || body.monto === null || body.monto === ''
                ? saldoPendiente
                : numeroPositivo(body.monto, 'Monto a pagar')

            return ComprasService.pagarCompraEnTx(tx, {
                compraId: id,
                monto,
                cajaOrigen,
                fecha: new Date(),
            })
        })

        return NextResponse.json(compra)
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error registrando pago de factura:', error)
        return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 })
    }
}
