import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/clientes/:id
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const cliente = await prisma.cliente.update({
            where: { id },
            data: {
                ...(body.nombreComercial !== undefined && { nombreComercial: body.nombreComercial }),
                ...(body.contactoNombre !== undefined && { contactoNombre: body.contactoNombre || null }),
                ...(body.contactoTelefono !== undefined && { contactoTelefono: body.contactoTelefono || null }),
                ...(body.direccion !== undefined && { direccion: body.direccion || null }),
                ...(body.zona !== undefined && { zona: body.zona || null }),
                ...(body.segmento !== undefined && { segmento: body.segmento || null }),
                ...(body.frecuenciaSemanal !== undefined && { frecuenciaSemanal: parseInt(body.frecuenciaSemanal) }),
                ...(body.pedidoPromedioU !== undefined && { pedidoPromedioU: parseInt(body.pedidoPromedioU) }),
                ...(body.activo !== undefined && { activo: body.activo }),
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente)
    } catch (error) {
        console.error('Error updating cliente:', error)
        return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 })
    }
}

// DELETE /api/clientes/:id
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.cliente.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting cliente:', error)
        return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 })
    }
}
