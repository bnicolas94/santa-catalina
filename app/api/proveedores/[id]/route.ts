import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/proveedores/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const proveedor = await prisma.proveedor.findUnique({
            where: { id },
            include: {
                insumos: {
                    include: {
                        familia: true
                    }
                },
                movimientosStock: {
                    orderBy: { fecha: 'desc' },
                    take: 50,
                    include: {
                        insumo: true,
                        ubicacion: true
                    }
                },
                _count: {
                    select: {
                        insumos: true,
                        movimientosStock: true
                    }
                }
            }
        })

        if (!proveedor) {
            return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
        }

        return NextResponse.json(proveedor)
    } catch (error) {
        console.error('Error fetching proveedor:', error)
        return NextResponse.json({ error: 'Error al obtener el proveedor' }, { status: 500 })
    }
}

// PATCH /api/proveedores/[id]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { nombre, contacto, telefono, email, direccion, categoria, activo } = body

        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: {
                nombre,
                contacto,
                telefono,
                email,
                direccion,
                categoria,
                activo
            }
        })

        return NextResponse.json(proveedor)
    } catch (error) {
        console.error('Error updating proveedor:', error)
        return NextResponse.json({ error: 'Error al actualizar el proveedor' }, { status: 500 })
    }
}

// DELETE /api/proveedores/[id] (Borrado lógico)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // Verificamos si tiene movimientos antes de "borrar" (desactivar)
        const count = await prisma.movimientoStock.count({
            where: { proveedorId: id }
        })

        if (count > 0) {
            // Si tiene movimientos, forzamos borrado lógico
            const proveedor = await prisma.proveedor.update({
                where: { id },
                data: { activo: false }
            })
            return NextResponse.json({ message: 'Proveedor desactivado debido a que tiene historial de movimientos', proveedor })
        }

        // Si no tiene historial, lo desactivamos siguiendo el plan.
        const proveedor = await prisma.proveedor.update({
            where: { id },
            data: { activo: false }
        })

        return NextResponse.json({ message: 'Proveedor desactivado correctamente', proveedor })
    } catch (error) {
        console.error('Error deleting proveedor:', error)
        return NextResponse.json({ error: 'Error al procesar la baja del proveedor' }, { status: 500 })
    }
}
