import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/gastos/categorias
export async function GET() {
    try {
        const categorias = await prisma.categoriaGasto.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
        })
        return NextResponse.json(categorias)
    } catch (error) {
        console.error('Error fetching categorias de gasto:', error)
        return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
    }
}

// POST /api/gastos/categorias
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombre, descripcion, color } = body

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
        }

        const categoria = await prisma.categoriaGasto.create({
            data: {
                nombre,
                descripcion: descripcion || null,
                color: color || '#808080',
            },
        })

        return NextResponse.json(categoria, { status: 201 })
    } catch (error) {
        console.error('Error creating categoria de gasto:', error)
        return NextResponse.json({ error: 'Error al crear la categoría' }, { status: 500 })
    }
}
