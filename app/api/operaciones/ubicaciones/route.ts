import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Catálogo de sólo lectura usado por selectores operativos.
export async function GET() {
    try {
        const ubicaciones = await prisma.ubicacion.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' },
            select: { id: true, nombre: true, tipo: true },
        })

        return NextResponse.json(ubicaciones)
    } catch (error: unknown) {
        console.error('Error fetching operational locations:', error)
        return NextResponse.json({ error: 'Error al obtener ubicaciones' }, { status: 500 })
    }
}
