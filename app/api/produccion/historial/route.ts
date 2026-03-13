import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/produccion/historial — Reporte de posicionamiento histórico
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const desdeStr = searchParams.get('desde')
        const hastaStr = searchParams.get('hasta')
        const empleadoId = searchParams.get('empleadoId')
        const ubicacionId = searchParams.get('ubicacionId')

        const where: any = {}

        if (desdeStr || hastaStr) {
            where.fecha = {}
            if (desdeStr) {
                const desde = new Date(desdeStr)
                desde.setHours(0, 0, 0, 0)
                where.fecha.gte = desde
            }
            if (hastaStr) {
                const hasta = new Date(hastaStr)
                hasta.setHours(23, 59, 59, 999)
                where.fecha.lte = hasta
            }
        }

        if (empleadoId) where.empleadoId = empleadoId
        if (ubicacionId) where.ubicacionId = ubicacionId

        const historial = await prisma.asignacionOperario.findMany({
            where,
            include: {
                empleado: {
                    select: { id: true, nombre: true, apellido: true }
                },
                concepto: {
                    select: { id: true, nombre: true }
                },
                ubicacion: {
                    select: { id: true, nombre: true }
                }
            },
            orderBy: { fecha: 'desc' }
        })

        return NextResponse.json(historial)
    } catch (error) {
        console.error('Error fetching history:', error)
        return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
    }
}
