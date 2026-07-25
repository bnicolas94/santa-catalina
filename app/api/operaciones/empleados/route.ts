import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Directorio operativo mínimo. No expone DNI, email, teléfono, salario ni credenciales.
export async function GET() {
    try {
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
            select: {
                id: true,
                nombre: true,
                apellido: true,
                rol: true,
                activo: true,
                ubicacionId: true,
            },
        })

        return NextResponse.json(empleados)
    } catch (error: unknown) {
        console.error('Error fetching operational employees:', error)
        return NextResponse.json({ error: 'Error al obtener personal operativo' }, { status: 500 })
    }
}
