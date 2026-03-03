import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/pedidos/:id — Cambiar estado
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const pedido = await prisma.pedido.update({
            where: { id },
            data: {
                ...(body.estado !== undefined && { estado: body.estado }),
            },
            include: {
                cliente: { select: { id: true, nombreComercial: true } },
                detalles: {
                    include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } },
                },
            },
        })

        return NextResponse.json(pedido)
    } catch (error) {
        console.error('Error updating pedido:', error)
        return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 })
    }
}
