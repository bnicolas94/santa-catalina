import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { normalizarNombreInsumo } from '@/lib/insumos/nombres'
import { motivoBloqueoDesactivacion } from '@/lib/insumos/desactivacion'

class InsumoDesactivacionError extends Error {}

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
        if (body.nombre !== undefined || body.activo === true) {
            const actual = await prisma.insumo.findUnique({ where: { id }, select: { nombre: true } })
            if (!actual) return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 })
            const nombreObjetivo = body.nombre !== undefined ? String(body.nombre) : actual.nombre
            const otros = await prisma.insumo.findMany({ where: { id: { not: id }, activo: true }, select: { nombre: true } })
            if (otros.some(item => normalizarNombreInsumo(item.nombre) === normalizarNombreInsumo(nombreObjetivo))) {
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

// DELETE /api/insumos/:id — Desactivar sin borrar historial ni relaciones.
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const insumo = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'insumo:' + id}))::text AS lock_result`
            const actual = await tx.insumo.findUnique({
                where: { id },
                include: {
                    stocks: { select: { cantidad: true, cantidadSecundaria: true } },
                    _count: { select: { fichasTecnicas: true } },
                },
            })
            if (!actual) throw new InsumoDesactivacionError('Insumo no encontrado')
            if (!actual.activo) return actual

            const motivoBloqueo = motivoBloqueoDesactivacion({
                stockActual: actual.stockActual,
                stockActualSecundario: actual.stockActualSecundario,
                stocks: actual.stocks,
                cantidadFichasTecnicas: actual._count.fichasTecnicas,
            })
            if (motivoBloqueo) throw new InsumoDesactivacionError(motivoBloqueo)

            return tx.insumo.update({ where: { id }, data: { activo: false } })
        })
        return NextResponse.json({ success: true, insumo })
    } catch (error) {
        console.error('Error desactivando insumo:', error)
        if (error instanceof InsumoDesactivacionError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'No se pudo desactivar el insumo' }, { status: 500 })
    }
}
