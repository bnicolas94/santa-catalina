import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/insumos/:id — Actualizar insumo
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const insumo = await prisma.insumo.update({
            where: { id },
            data: {
                ...(body.nombre !== undefined && { nombre: body.nombre }),
                ...(body.unidadMedida !== undefined && { unidadMedida: body.unidadMedida }),
                ...(body.stockActual !== undefined && { stockActual: parseFloat(body.stockActual) || 0 }),
                ...(body.stockMinimo !== undefined && { stockMinimo: parseFloat(body.stockMinimo) || 0 }),
                ...(body.precioUnitario !== undefined && { precioUnitario: parseFloat(body.precioUnitario) || 0 }),
                ...(body.diasReposicion !== undefined && { diasReposicion: parseInt(body.diasReposicion) || 1 }),
                ...(body.proveedorId !== undefined && { 
                    proveedor: body.proveedorId ? { connect: { id: body.proveedorId } } : { disconnect: true } 
                }),
                ...(body.familiaId !== undefined && { 
                    familia: body.familiaId ? { connect: { id: body.familiaId } } : { disconnect: true } 
                }),
                ...(body.activo !== undefined && { activo: body.activo }),
                ...(body.unidadSecundaria !== undefined && { unidadSecundaria: body.unidadSecundaria || null }),
                ...(body.factorConversion !== undefined && { factorConversion: parseFloat(body.factorConversion) || null }),
                ...(body.stockActualSecundario !== undefined && { stockActualSecundario: parseFloat(body.stockActualSecundario) || 0 }),
            },
            include: { proveedor: true, familia: true },
        })

        return NextResponse.json(insumo)
    } catch (error: any) {
        console.error('Error updating insumo:', error)
        return NextResponse.json({ error: 'Error al actualizar insumo' }, { status: 500 })
    }
}

// DELETE /api/insumos/:id — Eliminar insumo
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Delete related dependencies manually to mimic Cascade and avoid 500 error
        await prisma.fichaTecnica.deleteMany({ where: { insumoId: id } })
        await prisma.movimientoStock.deleteMany({ where: { insumoId: id } })
        await prisma.stockInsumo.deleteMany({ where: { insumoId: id } })

        await prisma.insumo.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting insumo:', error)
        return NextResponse.json({ error: 'Error al eliminar: Verifica que el insumo no tenga otras dependencias' }, { status: 400 })
    }
}
