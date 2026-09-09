import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const ubicaciones = await prisma.ubicacion.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        })
        return NextResponse.json(ubicaciones)
    } catch {
        return NextResponse.json({ error: 'Error al obtener ubicaciones' }, { status: 500 })
    }
}

export { POST, PATCH, DELETE } from '../sedes/route'
