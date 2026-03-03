import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/lotes
export async function GET() {
    try {
        const lotes = await prisma.lote.findMany({
            orderBy: { fechaProduccion: 'desc' },
            include: {
                producto: true,
                coordinador: { select: { id: true, nombre: true } },
                _count: { select: { detallePedidos: true } },
            },
        })
        return NextResponse.json(lotes)
    } catch (error) {
        console.error('Error fetching lotes:', error)
        return NextResponse.json({ error: 'Error al obtener lotes' }, { status: 500 })
    }
}

// POST /api/lotes
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { productoId, fechaProduccion, unidadesProducidas, empleadosRonda, coordinadorId } = body

        if (!productoId || !fechaProduccion || !unidadesProducidas) {
            return NextResponse.json({ error: 'Producto, fecha y unidades son requeridos' }, { status: 400 })
        }

        // Generar ID de lote: SC-YYYYMMDD-COD-NN
        const fecha = new Date(fechaProduccion)
        const yyyymmdd = fecha.toISOString().slice(0, 10).replace(/-/g, '')

        const producto = await prisma.producto.findUnique({ where: { id: productoId } })
        if (!producto) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
        }

        // Contar lotes del día para ese producto
        const startOfDay = new Date(fecha)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(fecha)
        endOfDay.setHours(23, 59, 59, 999)

        const countHoy = await prisma.lote.count({
            where: {
                productoId,
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
            },
        })

        const loteId = `SC-${yyyymmdd}-${producto.codigoInterno}-${String(countHoy + 1).padStart(2, '0')}`

        const lote = await prisma.lote.create({
            data: {
                id: loteId,
                fechaProduccion: fecha,
                horaInicio: new Date(),
                unidadesProducidas: parseInt(unidadesProducidas),
                empleadosRonda: parseInt(empleadosRonda) || 1,
                productoId,
                coordinadorId: coordinadorId || null,
            },
            include: {
                producto: true,
                coordinador: { select: { id: true, nombre: true } },
            },
        })

        return NextResponse.json(lote, { status: 201 })
    } catch (error) {
        console.error('Error creating lote:', error)
        return NextResponse.json({ error: 'Error al crear lote' }, { status: 500 })
    }
}
