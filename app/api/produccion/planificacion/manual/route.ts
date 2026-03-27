import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/produccion/planificacion/manual?fecha=YYYY-MM-DD
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha')
        if (!fechaStr) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

        const startOfDay = new Date(`${fechaStr}T00:00:00.000Z`)
        const endOfDay = new Date(`${fechaStr}T23:59:59.999Z`)

        const requerimientos = await prisma.requerimientoProduccion.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            include: { producto: true }
        })

        return NextResponse.json(requerimientos)
    } catch (error) {
        console.error('Error fetching manual requirements:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

// POST /api/produccion/planificacion/manual
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha: fechaStr, turno, productoId, presentacionId, cantidad } = body

        if (!fechaStr || !turno || !productoId) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const startOfDay = new Date(`${fechaStr}T00:00:00.000Z`)

        // Upsert: Si ya existe para ese día, turno, producto y presentación, actualizamos
        const targetDestino = body.destino || 'FABRICA'
        const existing = await prisma.requerimientoProduccion.findFirst({
            where: {
                fecha: startOfDay,
                turno,
                productoId,
                presentacionId: presentacionId || null,
                destino: targetDestino
            }
        })

        let result
        if (cantidad <= 0 && existing) {
            // Si mandan 0 o menos, eliminamos
            await prisma.requerimientoProduccion.delete({ where: { id: existing.id } })
            return NextResponse.json({ message: 'Eliminado' })
        } else if (existing) {
            result = await prisma.requerimientoProduccion.update({
                where: { id: existing.id },
                data: { cantidad: parseInt(cantidad) }
            })
        } else if (cantidad > 0) {
            result = await prisma.requerimientoProduccion.create({
                data: {
                    fecha: startOfDay,
                    turno,
                    productoId,
                    presentacionId,
                    cantidad: parseInt(cantidad),
                    destino: targetDestino
                }
            })
        }

        return NextResponse.json(result || { message: 'Sin cambios' })
    } catch (error) {
        console.error('Error saving manual requirement:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
