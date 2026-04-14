import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/fichas-tecnicas?productoId=xxx
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const productoId = searchParams.get('productoId')

        const where = productoId ? { productoId } : {}

        const fichas = await prisma.fichaTecnica.findMany({
            where,
            include: {
                insumo: true,
                producto: true,
            },
        })
        return NextResponse.json(fichas)
    } catch (error) {
        console.error('Error fetching fichas:', error)
        return NextResponse.json({ error: 'Error al obtener fichas técnicas' }, { status: 500 })
    }
}

// POST /api/fichas-tecnicas
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { productoId, insumoId, cantidadPorUnidad, unidadMedida, merma } = body

        if (!productoId || !insumoId || !cantidadPorUnidad || !unidadMedida) {
            return NextResponse.json(
                { error: 'Todos los campos son requeridos' },
                { status: 400 }
            )
        }

        const ficha = await prisma.fichaTecnica.create({
            data: {
                productoId,
                insumoId,
                cantidadPorUnidad: parseFloat(cantidadPorUnidad),
                unidadMedida,
                merma: merma ? parseFloat(merma) : 0,
            },
            include: { insumo: true },
        })

        return NextResponse.json(ficha, { status: 201 })
    } catch (error) {
        console.error('Error creating ficha:', error)
        return NextResponse.json({ error: 'Error al crear ficha técnica' }, { status: 500 })
    }
}

// DELETE /api/fichas-tecnicas
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
        }

        await prisma.fichaTecnica.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting ficha:', error)
        return NextResponse.json({ error: 'Error al eliminar ficha técnica' }, { status: 500 })
    }
}
