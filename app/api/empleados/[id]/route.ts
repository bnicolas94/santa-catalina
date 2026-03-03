import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/empleados/:id — Actualizar empleado
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const empleado = await prisma.empleado.update({
            where: { id },
            data: body,
            select: {
                id: true,
                nombre: true,
                email: true,
                rol: true,
                telefono: true,
                activo: true,
            },
        })

        return NextResponse.json(empleado)
    } catch (error) {
        console.error('Error updating empleado:', error)
        return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 })
    }
}

// DELETE /api/empleados/:id — Eliminar empleado
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.empleado.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting empleado:', error)
        return NextResponse.json({ error: 'Error al eliminar empleado' }, { status: 500 })
    }
}
