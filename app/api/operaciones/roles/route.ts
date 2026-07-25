import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Lista mínima para filtros de operación; la configuración completa sigue siendo ADMIN.
export async function GET() {
    try {
        const roles = await prisma.rolEmpleado.findMany({
            orderBy: { nombre: 'asc' },
            select: { id: true, nombre: true },
        })

        return NextResponse.json(roles)
    } catch (error: unknown) {
        console.error('Error fetching operational roles:', error)
        return NextResponse.json({ error: 'Error al obtener roles operativos' }, { status: 500 })
    }
}
