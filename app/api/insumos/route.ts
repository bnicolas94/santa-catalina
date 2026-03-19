import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/insumos
export async function GET() {
    try {
        const insumos = await prisma.insumo.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                proveedor: true,
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
        const body = await request.json()
        const { nombre, unidadMedida, stockActual, stockMinimo, precioUnitario, diasReposicion, proveedorId, familiaId } = body

        if (!nombre || !unidadMedida) {
            return NextResponse.json(
                { error: 'Nombre y unidad de medida son requeridos' },
                { status: 400 }
            )
        }

        const insumo = await prisma.insumo.create({
            data: {
                nombre,
                unidadMedida,
                stockActual: parseFloat(stockActual) || 0,
                stockMinimo: parseFloat(stockMinimo) || 0,
                precioUnitario: parseFloat(precioUnitario) || 0,
                diasReposicion: parseInt(diasReposicion) || 1,
                proveedor: proveedorId ? { connect: { id: proveedorId } } : undefined,
                familia: familiaId ? { connect: { id: familiaId } } : undefined,
                unidadSecundaria: body.unidadSecundaria || null,
                factorConversion: parseFloat(body.factorConversion) || null,
            },
            include: { proveedor: true, familia: true },
        })

        return NextResponse.json(insumo, { status: 201 })
    } catch (error) {
        console.error('Error creating insumo:', error)
        return NextResponse.json({ error: 'Error al crear insumo' }, { status: 500 })
    }
}
