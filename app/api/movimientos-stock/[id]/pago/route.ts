import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    distribuirPagoEntreItems,
    estadoPagoDesdeMontos,
    numeroPositivo,
    validarCajaCompra,
} from '@/lib/compras/validacion'

// PUT /api/movimientos-stock/:id/pago — registra un pago sobre la compra completa.
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
            // El cuerpo es opcional: sin monto se cancela todo el saldo.
        }
        const cajaOrigen = validarCajaCompra(body.cajaOrigen || 'caja_chica')

        const actualizado = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'pago-compra:' + id}))::text AS lock_result`
            const movimiento = await tx.movimientoStock.findUnique({
                where: { id },
                include: { compra: true, insumo: true, proveedor: true },
            })
            if (!movimiento || movimiento.tipo !== 'entrada') {
                throw new CompraValidationError('Movimiento no encontrado o no es una compra')
            }
            if (!movimiento.costoTotal) {
                throw new CompraValidationError('La compra no tiene un costo total registrado')
            }

            if (movimiento.compraId) {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'pago-compra:' + movimiento.compraId}))::text AS lock_result`
            }

            let compraId = movimiento.compraId
            if (!compraId) {
                const compra = await tx.compra.create({
                    data: {
                        proveedorId: movimiento.proveedorId,
                        ubicacionId: movimiento.ubicacionId,
                        numeroFactura: movimiento.numeroFactura,
                        fechaMovimiento: movimiento.fecha,
                        fechaFactura: movimiento.fechaFactura,
                        estadoPago: movimiento.estadoPago || 'pendiente',
                        costoTotal: movimiento.costoTotal,
                        montoPagado: movimiento.montoPagado || 0,
                        observaciones: movimiento.observaciones,
                        movimientosStock: { connect: { id: movimiento.id } },
                    },
                })
                compraId = compra.id
            }

            const items = await tx.movimientoStock.findMany({
                where: { compraId, tipo: 'entrada' },
                select: { id: true, costoTotal: true, montoPagado: true },
            })
            const costoTotal = items.reduce((acc, item) => acc + (item.costoTotal || 0), 0)
            const yaPagado = items.reduce((acc, item) => acc + (item.montoPagado || 0), 0)
            const saldoPendiente = costoTotal - yaPagado
            if (saldoPendiente <= 0.01) throw new CompraValidationError('La compra ya está totalmente pagada')

            const montoAPagar = body.monto === undefined || body.monto === null || body.monto === ''
                ? saldoPendiente
                : numeroPositivo(body.monto, 'Monto a pagar')
            const distribucion = distribuirPagoEntreItems(items, montoAPagar)
            const nuevoMontoPagado = yaPagado + montoAPagar
            const nuevoEstado = estadoPagoDesdeMontos(costoTotal, nuevoMontoPagado)

            const compra = await tx.compra.findUnique({
                where: { id: compraId },
                include: { proveedor: { select: { nombre: true } } },
            })
            if (!compra) throw new CompraValidationError('Compra no encontrada')

            await ComprasService.registrarPagoEnTx(tx, {
                compraId,
                monto: montoAPagar,
                pagos: [{ cajaOrigen, monto: montoAPagar }],
                fecha: new Date(),
                ubicacionId: compra.ubicacionId,
                descripcion: nuevoEstado === 'pagado'
                    ? `Pago final de compra${compra.numeroFactura ? ` Fac. ${compra.numeroFactura}` : ''} - ${compra.proveedor?.nombre || 'General'}`
                    : `Pago a cuenta de compra${compra.numeroFactura ? ` Fac. ${compra.numeroFactura}` : ''} - ${compra.proveedor?.nombre || 'General'}`,
            })

            for (const item of items) {
                const asignado = distribucion.get(item.id) || 0
                await tx.movimientoStock.update({
                    where: { id: item.id },
                    data: {
                        montoPagado: { increment: asignado },
                        estadoPago: nuevoEstado,
                    },
                })
            }
            await tx.compra.update({
                where: { id: compraId },
                data: {
                    costoTotal,
                    montoPagado: nuevoMontoPagado,
                    estadoPago: nuevoEstado,
                },
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
