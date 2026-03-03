import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/clientes
export async function GET() {
    try {
        const clientes = await prisma.cliente.findMany({
            orderBy: { nombreComercial: 'asc' },
            include: { _count: { select: { pedidos: true } } },
        })
        return NextResponse.json(clientes)
    } catch (error) {
        console.error('Error fetching clientes:', error)
        return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
    }
}

// POST /api/clientes
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombreComercial, contactoNombre, contactoTelefono, direccion, zona, segmento, frecuenciaSemanal, pedidoPromedioU } = body

        if (!nombreComercial) {
            return NextResponse.json({ error: 'El nombre comercial es requerido' }, { status: 400 })
        }

        const cliente = await prisma.cliente.create({
            data: {
                nombreComercial,
                contactoNombre: contactoNombre || null,
                contactoTelefono: contactoTelefono || null,
                direccion: direccion || null,
                zona: zona || null,
                segmento: segmento || null,
                frecuenciaSemanal: parseInt(frecuenciaSemanal) || 0,
                pedidoPromedioU: parseInt(pedidoPromedioU) || 0,
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente, { status: 201 })
    } catch (error) {
        console.error('Error creating cliente:', error)
        return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
    }
}
