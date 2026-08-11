import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { normalizarNombreInsumo } from '@/lib/insumos/nombres'

function proveedorIdsDelBody(body: Record<string, unknown>): string[] {
    const ids = Array.isArray(body.proveedorIds)
        ? body.proveedorIds.map(String).filter(Boolean)
        : (body.proveedorId ? [String(body.proveedorId)] : [])
    return [...new Set(ids)]
}

// GET /api/insumos
export async function GET() {
    try {
        const insumos = await prisma.insumo.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                proveedor: true,
                proveedores: { include: { proveedor: true }, orderBy: { esPrincipal: 'desc' } },
                familia: true,
                stocks: { include: { ubicacion: true } }
            },
        })
        return NextResponse.json(insumos)
    } catch (error) {
        console.error('Error fetching insumos:', error)
        return NextResponse.json({ error: 'Error al obtener insumos' }, { status: 500 })
    }
}

// POST /api/insumos
export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const { nombre, unidadMedida, stockActual, stockMinimo, precioUnitario, diasReposicion, proveedorId, familiaId } = body
        const proveedorIds = proveedorIdsDelBody(body)
        const proveedorPrincipalId = proveedorIds[0] || (proveedorId ? String(proveedorId) : null)

        if (!nombre || !unidadMedida) {
            return NextResponse.json(
                { error: 'Nombre y unidad de medida son requeridos' },
                { status: 400 }
            )
        }
        const nombresExistentes = await prisma.insumo.findMany({ where: { activo: true }, select: { nombre: true } })
        if (nombresExistentes.some(item => normalizarNombreInsumo(item.nombre) === normalizarNombreInsumo(String(nombre)))) {
            return NextResponse.json({ error: 'Ya existe un insumo activo con ese nombre. Asociá el nuevo proveedor al insumo existente.' }, { status: 400 })
        }

        const insumo = await prisma.insumo.create({
            data: {
                nombre: String(nombre),
                unidadMedida: String(unidadMedida),
                stockActual: parseFloat(String(stockActual || '')) || 0,
                stockMinimo: parseFloat(String(stockMinimo || '')) || 0,
                precioUnitario: parseFloat(String(precioUnitario || '')) || 0,
                diasReposicion: parseInt(String(diasReposicion || '')) || 1,
                proveedor: proveedorPrincipalId ? { connect: { id: proveedorPrincipalId } } : undefined,
                proveedores: proveedorIds.length > 0 ? {
                    create: proveedorIds.map((id, index) => ({ proveedorId: id, esPrincipal: index === 0 })),
                } : undefined,
                familia: familiaId ? { connect: { id: String(familiaId) } } : undefined,
                unidadSecundaria: body.unidadSecundaria ? String(body.unidadSecundaria) : null,
                factorConversion: parseFloat(String(body.factorConversion || '')) || null,
                stockActualSecundario: parseFloat(String(body.stockActualSecundario || '')) || 0,
            },
            include: { proveedor: true, proveedores: { include: { proveedor: true } }, familia: true },
        })

        return NextResponse.json(insumo, { status: 201 })
    } catch (error) {
        console.error('Error creating insumo:', error)
        return NextResponse.json({ error: 'Error al crear insumo' }, { status: 500 })
    }
}
