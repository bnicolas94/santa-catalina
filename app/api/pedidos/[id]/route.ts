import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

// PUT /api/pedidos/:id — Editar pedido (estado, medioPago, fechaEntrega, abonado, etc.)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {}
        if (body.estado !== undefined) data.estado = body.estado
        if (body.medioPago !== undefined) data.medioPago = body.medioPago
        if (body.fechaEntrega !== undefined) data.fechaEntrega = new Date(body.fechaEntrega)
        if (body.abonado !== undefined) data.abonado = body.abonado

        const result = await prisma.$transaction(async (tx) => {
            const current = await tx.pedido.findUnique({ 
                where: { id },
                include: {
                    detalles: {
                        include: { presentacion: { select: { id: true, cantidad: true } } }
                    }
                }
            })
            if (!current) throw new Error('Pedido no encontrado')

            // Determinar medioPago para el cálculo (el del body o el actual)
            const medioParaCalcular = body.medioPago !== undefined ? body.medioPago : current.medioPago
            
            // 1. Calcular Total Base (sin descuentos)
            const baseTotal = current.detalles.reduce((acc, d) => acc + (d.cantidad * d.precioUnitario), 0)
            
            // 2. Calcular Descuento si es Efectivo
            let totalDescuento = 0
            if (medioParaCalcular === 'efectivo') {
                const packMap = new Map<number, number>()
                current.detalles.forEach(d => {
                    if (d.nroPack !== null) {
                        const units = d.cantidad * d.presentacion.cantidad
                        packMap.set(d.nroPack, (packMap.get(d.nroPack) || 0) + units)
                    }
                })
                for (const units of packMap.values()) {
                    if (units >= 48) totalDescuento += 2000
                    else if (units >= 24) totalDescuento += 1000
                }
            }

            const totalRecalculado = Math.round(baseTotal - totalDescuento)
            data.totalImporte = totalRecalculado

            const pedido = await tx.pedido.update({
                where: { id },
                data,
                include: {
                    cliente: { select: { id: true, nombreComercial: true } },
                    detalles: {
                        include: {
                            presentacion: {
                                include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } },
                            },
                        },
                    },
                },
            })

            // Si se marca como abonado (y antes no lo estaba), registramos en caja con el total recalculado
            if (data.abonado === true && current.abonado === false) {
                await CajaService.createMovimientoEnTx(tx, {
                    tipo: 'ingreso',
                    concepto: 'cobro_pedido',
                    monto: pedido.totalImporte,
                    medioPago: 'transferencia',
                    cajaOrigen: 'mercado_pago_juani',
                    descripcion: `Pedido abonado (${pedido.cliente.nombreComercial})`,
                    pedidoId: pedido.id,
                    fecha: new Date(),
                })
            }

            return pedido
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error updating pedido:', error)
        return NextResponse.json({ error: error.message || 'Error al actualizar pedido' }, { status: 500 })
    }
}

// DELETE /api/pedidos/:id — Eliminar pedido y sus detalles
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Limpiar relaciones y luego eliminar pedido
        await prisma.$transaction([
            prisma.movimientoCaja.deleteMany({ where: { pedidoId: id } }),
            prisma.entrega.deleteMany({ where: { pedidoId: id } }),
            prisma.detallePedido.deleteMany({ where: { pedidoId: id } }),
            prisma.pedido.delete({ where: { id } }),
        ])

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error deleting pedido:', error)
        return NextResponse.json({ error: 'Error al eliminar pedido' }, { status: 500 })
    }
}
