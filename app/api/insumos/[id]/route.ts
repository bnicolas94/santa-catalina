import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { normalizarNombreInsumo } from '@/lib/insumos/nombres'

function proveedorIdsDelBody(body: Record<string, unknown>): string[] | null {
    if (!Array.isArray(body.proveedorIds)) return null
    return [...new Set(body.proveedorIds.map(String).filter(Boolean))]
}

// PUT /api/insumos/:id — Actualizar insumo
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json() as Record<string, unknown>
        const proveedorIds = proveedorIdsDelBody(body)
        const proveedorPrincipalId = proveedorIds?.[0] || (body.proveedorId ? String(body.proveedorId) : null)
        if (body.nombre !== undefined) {
            const otros = await prisma.insumo.findMany({ where: { id: { not: id }, activo: true }, select: { nombre: true } })
            if (otros.some(item => normalizarNombreInsumo(item.nombre) === normalizarNombreInsumo(String(body.nombre)))) {
                return NextResponse.json({ error: 'Ya existe otro insumo activo con ese nombre. Usá la opción Unificar.' }, { status: 400 })
            }
        }

        const insumo = await prisma.$transaction(async tx => {
            if (proveedorIds) {
                await tx.insumoProveedor.deleteMany({ where: { insumoId: id } })
                if (proveedorIds.length > 0) {
                    await tx.insumoProveedor.createMany({
                        data: proveedorIds.map((proveedorId, index) => ({ insumoId: id, proveedorId, esPrincipal: index === 0 })),
                    })
                }
            }
            return tx.insumo.update({
                where: { id },
                data: {
                ...(body.nombre !== undefined && { nombre: String(body.nombre) }),
                ...(body.unidadMedida !== undefined && { unidadMedida: String(body.unidadMedida) }),
                ...(body.stockMinimo !== undefined && { stockMinimo: parseFloat(String(body.stockMinimo)) || 0 }),
                ...(body.precioUnitario !== undefined && { precioUnitario: parseFloat(String(body.precioUnitario)) || 0 }),
                ...(body.diasReposicion !== undefined && { diasReposicion: parseInt(String(body.diasReposicion)) || 1 }),
                ...((body.proveedorId !== undefined || proveedorIds) && {
                    proveedor: proveedorPrincipalId ? { connect: { id: proveedorPrincipalId } } : { disconnect: true }
                }),
                ...(body.familiaId !== undefined && { 
                    familia: body.familiaId ? { connect: { id: String(body.familiaId) } } : { disconnect: true }
                }),
                ...(body.activo !== undefined && { activo: Boolean(body.activo) }),
                ...(body.unidadSecundaria !== undefined && { unidadSecundaria: body.unidadSecundaria ? String(body.unidadSecundaria) : null }),
                ...(body.factorConversion !== undefined && { factorConversion: parseFloat(String(body.factorConversion)) || null }),
                },
                include: { proveedor: true, proveedores: { include: { proveedor: true } }, familia: true },
            })
        })

        return NextResponse.json(insumo)
    } catch (error: unknown) {
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
