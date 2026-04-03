import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const anio = searchParams.get('anio')

        let whereClause: any = {}
        if (anio) {
            const startDate = new Date(`${anio}-01-01T00:00:00.000Z`)
            const endDate = new Date(`${anio}-12-31T23:59:59.999Z`)
            whereClause.fecha = {
                gte: startDate,
                lte: endDate
            }
        }

        const feriados = await prisma.feriado.findMany({
            where: whereClause,
            orderBy: { fecha: 'asc' }
        })

        return NextResponse.json(feriados)
    } catch (error) {
        console.error('Error fetching feriados:', error)
        return NextResponse.json({ error: 'Error al obtener feriados' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha, nombre } = body

        if (!fecha || !nombre) {
            return NextResponse.json({ error: 'Fecha y nombre son obligatorios' }, { status: 400 })
        }

        const feriado = await prisma.feriado.create({
            data: {
                fecha: new Date(`${fecha}T12:00:00`),
                nombre
            }
        })

        return NextResponse.json(feriado, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un feriado en esa fecha' }, { status: 400 })
        }
        console.error('Error creating feriado:', error)
        return NextResponse.json({ error: 'Error al crear feriado' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID es obligatorio' }, { status: 400 })
        }

        await prisma.feriado.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting feriado:', error)
        return NextResponse.json({ error: 'Error al eliminar feriado' }, { status: 500 })
    }
}
