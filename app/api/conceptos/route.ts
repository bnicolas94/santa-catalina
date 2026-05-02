import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const conceptos = await prisma.conceptoSalarial.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        })
        return NextResponse.json(conceptos)
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener conceptos' }, { status: 500 })
    }
}
