import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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
                select: { id: true, abonado: true, totalImporte: true }
            })
            if (!current) throw new Error('Pedido no encontrado')

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

            // Si se marca como abonado (y antes no lo estaba), registramos en caja
            if (data.abonado === true && current.abonado === false) {
                await tx.movimientoCaja.create({
                    data: {
                        tipo: 'ingreso',
                        concepto: 'cobro_pedido',
                        monto: pedido.totalImporte,
                        medioPago: 'transferencia',
                        cajaOrigen: 'mercado_pago_juani',
                        descripcion: `Pedido abonado (${pedido.cliente.nombreComercial})`,
                        pedidoId: pedido.id,
                        fecha: new Date(),
                    }
                })

                await tx.saldoCaja.upsert({
                    where: { tipo: 'mercado_pago_juani' },
                    create: { tipo: 'mercado_pago_juani', saldo: pedido.totalImporte },
                    update: { saldo: { increment: pedido.totalImporte } }
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
