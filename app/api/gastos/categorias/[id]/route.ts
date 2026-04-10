import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { nombre, color } = await request.json()

        const categoria = await prisma.categoriaGasto.update({
            where: { id },
            data: {
                nombre,
                color
            }
        })

        return NextResponse.json(categoria)
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 })
        }
        console.error('Error al actualizar categoría', error)
        return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        await prisma.categoriaGasto.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error al desactivar categoría', error)
        return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 })
    }
}
