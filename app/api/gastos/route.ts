import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/gastos
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const mes = searchParams.get('mes')
        const anio = searchParams.get('anio')

        let whereClause = {}
        if (mes && anio) {
            const startOfMonth = new Date(parseInt(anio), parseInt(mes) - 1, 1)
            const endOfMonth = new Date(parseInt(anio), parseInt(mes), 0, 23, 59, 59, 999)
            whereClause = {
                fecha: { gte: startOfMonth, lte: endOfMonth }
            }
        }

        const gastos = await prisma.gastoOperativo.findMany({
            where: whereClause,
            orderBy: { fecha: 'desc' },
            include: { categoria: true },
        })

        return NextResponse.json(gastos)
    } catch (error) {
        console.error('Error fetching gastos:', error)
        return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 })
    }
}

// POST /api/gastos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha, monto, descripcion, categoriaId, recurrente } = body

        if (!fecha || !monto || !descripcion || !categoriaId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        const gasto = await prisma.gastoOperativo.create({
            data: {
                fecha: new Date(fecha),
                monto: parseFloat(monto),
                descripcion,
                categoriaId,
                recurrente: Boolean(recurrente),
            },
            include: { categoria: true }
        })

        return NextResponse.json(gasto, { status: 201 })
    } catch (error) {
        console.error('Error creating gasto:', error)
        return NextResponse.json({ error: 'Error al registrar el gasto' }, { status: 500 })
    }
}
