import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/movimientos-stock
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const insumoId = searchParams.get('insumoId')

        const movimientos = await prisma.movimientoStock.findMany({
            where: insumoId ? { insumoId } : {},
            orderBy: { fecha: 'desc' },
            take: 100,
            include: {
                insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                proveedor: { select: { id: true, nombre: true } },
                loteOrigen: { select: { id: true } },
            },
        })
        return NextResponse.json(movimientos)
    } catch (error) {
        console.error('Error fetching movimientos:', error)
        return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 })
    }
}

// POST /api/movimientos-stock
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { insumoId, tipo, cantidad, observaciones, proveedorId } = body

        if (!insumoId || !tipo || !cantidad) {
            return NextResponse.json({ error: 'Insumo, tipo y cantidad son requeridos' }, { status: 400 })
        }

        if (!['entrada', 'salida'].includes(tipo)) {
            return NextResponse.json({ error: 'Tipo debe ser "entrada" o "salida"' }, { status: 400 })
        }

        const cant = parseFloat(cantidad)

        // Crear movimiento
        const movimiento = await prisma.movimientoStock.create({
            data: {
                insumoId,
                tipo,
                cantidad: cant,
                observaciones: observaciones || null,
                proveedorId: proveedorId || null,
            },
            include: {
                insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                proveedor: { select: { id: true, nombre: true } },
            },
        })

        // Actualizar stock del insumo
        const delta = tipo === 'entrada' ? cant : -cant
        await prisma.insumo.update({
            where: { id: insumoId },
            data: { stockActual: { increment: delta } },
        })

        return NextResponse.json(movimiento, { status: 201 })
    } catch (error) {
        console.error('Error creating movimiento:', error)
        return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
    }
}
