import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/familias-insumo
export async function GET() {
    try {
        const familias = await prisma.familiaInsumo.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { insumos: true } },
            },
        })
        return NextResponse.json(familias)
    } catch (error) {
        console.error('Error fetching familias:', error)
        return NextResponse.json({ error: 'Error al obtener familias' }, { status: 500 })
    }
}

// POST /api/familias-insumo
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, color } = body

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
        }

        const existing = await prisma.familiaInsumo.findUnique({ where: { nombre } })
        if (existing) {
            return NextResponse.json({ error: 'Ya existe una familia con ese nombre' }, { status: 400 })
        }

        const familia = await prisma.familiaInsumo.create({
            data: { nombre, color: color || null },
            include: { _count: { select: { insumos: true } } },
        })

        return NextResponse.json(familia, { status: 201 })
    } catch (error) {
        console.error('Error creating familia:', error)
        return NextResponse.json({ error: 'Error al crear familia' }, { status: 500 })
    }
}
