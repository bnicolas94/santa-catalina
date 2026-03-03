import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/productos/:id
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const producto = await prisma.producto.update({
            where: { id },
            data: {
                ...(body.nombre !== undefined && { nombre: body.nombre }),
                ...(body.codigoInterno !== undefined && { codigoInterno: body.codigoInterno }),
                ...(body.vidaUtilHoras !== undefined && { vidaUtilHoras: parseInt(body.vidaUtilHoras) }),
                ...(body.tempConservacionMax !== undefined && { tempConservacionMax: parseFloat(body.tempConservacionMax) }),
                ...(body.planchasPorPaquete !== undefined && { planchasPorPaquete: parseInt(body.planchasPorPaquete) }),
                ...(body.paquetesPorRonda !== undefined && { paquetesPorRonda: parseInt(body.paquetesPorRonda) }),
                ...(body.activo !== undefined && { activo: body.activo }),
            },
            include: {
                presentaciones: { orderBy: { cantidad: 'desc' } },
                fichasTecnicas: { include: { insumo: true } },
            },
        })

        return NextResponse.json(producto)
    } catch (error) {
        console.error('Error updating producto:', error)
        return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 })
    }
}

// DELETE /api/productos/:id
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.producto.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting producto:', error)
        return NextResponse.json({ error: 'Error al eliminar producto. Puede tener lotes o pedidos asociados.' }, { status: 500 })
    }
}
