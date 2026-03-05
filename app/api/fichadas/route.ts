import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/fichadas — Lista fichadas (con opción de filtrado)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const mes = searchParams.get('mes') // formato YYYY-MM

        let whereClause: any = {}

        if (empleadoId) {
            whereClause.empleadoId = empleadoId
        }

        if (mes) {
            const startDate = new Date(`${mes}-01T00:00:00.000Z`)
            const endDate = new Date(startDate)
            endDate.setMonth(endDate.getMonth() + 1)

            whereClause.fechaHora = {
                gte: startDate,
                lt: endDate
            }
        }

        const fichadas = await prisma.fichadaEmpleado.findMany({
            where: whereClause,
            orderBy: { fechaHora: 'desc' },
            include: {
                empleado: {
                    select: { nombre: true, apellido: true }
                }
            }
        })

        return NextResponse.json(fichadas)
    } catch (error) {
        console.error('Error fetching fichadas:', error)
        return NextResponse.json({ error: 'Error al obtener fichadas' }, { status: 500 })
    }
}

// POST /api/fichadas — Crear fichada manual
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fechaHora, tipo, origen } = body

        if (!empleadoId || !fechaHora || !tipo) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const fichada = await prisma.fichadaEmpleado.create({
            data: {
                empleadoId,
                fechaHora: new Date(fechaHora),
                tipo,
                origen: origen || 'manual'
            }
        })

        return NextResponse.json(fichada, { status: 201 })
    } catch (error) {
        console.error('Error creating fichada:', error)
        return NextResponse.json({ error: 'Error al registrar fichada' }, { status: 500 })
    }
}
