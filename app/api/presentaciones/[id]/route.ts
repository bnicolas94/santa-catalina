import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/presentaciones/:id
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const presentacion = await prisma.presentacion.update({
            where: { id },
            data: {
                ...(body.cantidad !== undefined && { cantidad: parseInt(String(body.cantidad)) }),
                ...(body.precioVenta !== undefined && { precioVenta: parseFloat(String(body.precioVenta)) }),
                ...(body.stockMinimo !== undefined && { stockMinimo: parseInt(String(body.stockMinimo)) }),
                ...(body.activo !== undefined && { activo: body.activo }),
            },
        })

        return NextResponse.json(presentacion)
    } catch (error) {
        console.error('Error updating presentacion:', error)
        return NextResponse.json({ error: 'Error al actualizar presentación' }, { status: 500 })
    }
}

// DELETE /api/presentaciones/:id
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.presentacion.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting presentacion:', error)
        return NextResponse.json({ error: 'No se puede eliminar la presentación: Tiene pedidos asociados.' }, { status: 400 })
    }
}
