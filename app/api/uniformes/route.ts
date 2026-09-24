import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar uniformes.' }, { status: 403 })
    try {
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            select: {
                id: true, nombre: true, apellido: true, ubicacionId: true,
                talleUniforme: { select: { remera: true, buzo: true } }
            },
            orderBy: {
                nombre: 'asc'
            }
        })
        return NextResponse.json(empleados)
    } catch {
        return NextResponse.json({ error: 'Error al obtener empleados' }, { status: 500 })
    }
}
