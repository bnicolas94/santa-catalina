import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/produccion/conceptos — Lista todos los conceptos activos
export async function GET() {
    try {
        const conceptos = await prisma.conceptoProduccion.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
        })
        return NextResponse.json(conceptos)
    } catch (error) {
        console.error('Error fetching conceptos:', error)
        return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 })
    }
}

// POST /api/produccion/conceptos — Crear nuevo concepto
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, descripcion } = body

        if (!nombre) {
            return NextResponse.json(
                { error: 'El nombre es requerido' },
                { status: 400 }
            )
        }

        const concepto = await prisma.conceptoProduccion.create({
            data: {
                nombre,
                descripcion,
            },
        })

        return NextResponse.json(concepto, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Ya existe un concepto con este nombre' },
                { status: 400 }
            )
        }
        console.error('Error creating concepto:', error)
        return NextResponse.json({ error: 'Error al crear concepto' }, { status: 500 })
    }
}
