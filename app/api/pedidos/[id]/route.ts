import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/pedidos/:id — Editar pedido (estado, medioPago, fechaEntrega, etc.)
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

        const pedido = await prisma.pedido.update({
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

        return NextResponse.json(pedido)
    } catch (error) {
        console.error('Error updating pedido:', error)
        return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 })
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
