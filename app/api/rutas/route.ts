import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/rutas
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const choferId = searchParams.get('choferId')
    const fechaStr = searchParams.get('fecha') // YYYY-MM-DD

    try {
        const whereClause: Record<string, unknown> = {}
        if (choferId) whereClause.choferId = choferId
        if (fechaStr) {
            const startOfDay = new Date(fechaStr)
            startOfDay.setUTCHours(0, 0, 0, 0)
            const endOfDay = new Date(fechaStr)
            endOfDay.setUTCHours(23, 59, 59, 999)
            whereClause.fecha = { gte: startOfDay, lte: endOfDay }
        }

        const rutas = await prisma.ruta.findMany({
            where: whereClause,
            orderBy: { fecha: 'desc' },
            include: {
                chofer: { select: { id: true, nombre: true } },
                entregas: {
                    include: {
                        pedido: {
                            include: {
                                detalles: {
                                    include: {
                                        presentacion: {
                                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } }
                                        }
                                    }
                                }
                            }
                        },
                        cliente: { select: { id: true, nombreComercial: true, direccion: true, zona: true } }
                    },
                    orderBy: { orden: 'asc' }
                }
            }
        })
        return NextResponse.json(rutas)
    } catch (error) {
        console.error('Error fetching rutas:', error)
        return NextResponse.json({ error: 'Error al obtener rutas' }, { status: 500 })
    }
}

// Las rutas históricas siguen disponibles para Caja y reportes.
export async function POST() {
    return NextResponse.json({ error: 'La creación de rutas del ERP fue deshabilitada.' }, { status: 410 })
}

export async function DELETE() {
    return NextResponse.json({ error: 'La eliminación de rutas del ERP fue deshabilitada para conservar stock e historial.' }, { status: 410 })
}
