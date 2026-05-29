import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            include: {
                talleUniforme: true
            },
            orderBy: {
                nombre: 'asc'
            }
        })
        return NextResponse.json(empleados)
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al obtener empleados', detalle: error.message }, { status: 500 })
    }
}
