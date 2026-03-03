import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/familias-insumo/:id
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const familia = await prisma.familiaInsumo.update({
            where: { id },
            data: {
                ...(body.nombre !== undefined && { nombre: body.nombre }),
                ...(body.color !== undefined && { color: body.color || null }),
            },
            include: { _count: { select: { insumos: true } } },
        })

        return NextResponse.json(familia)
    } catch (error) {
        console.error('Error updating familia:', error)
        return NextResponse.json({ error: 'Error al actualizar familia' }, { status: 500 })
    }
}

// DELETE /api/familias-insumo/:id
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Poner familiaId = null en los insumos de esta familia antes de borrarla
        await prisma.insumo.updateMany({
            where: { familiaId: id },
            data: { familiaId: null },
        })

        await prisma.familiaInsumo.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting familia:', error)
        return NextResponse.json({ error: 'Error al eliminar familia' }, { status: 500 })
    }
}
