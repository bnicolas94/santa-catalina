import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Catálogo mínimo para registrar egresos de nómina. La administración y los
// saldos de Caja no se exponen desde esta ruta de RR. HH.
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })

    try {
        const cajas = await prisma.saldoCaja.findMany({
            where: {
                activo: true,
                OR: [
                    { ubicacionId: null },
                    { ubicacion: { activo: true } },
                ],
            },
            select: {
                tipo: true,
                nombre: true,
                activo: true,
                ubicacionId: true,
                recibeDepositos: true,
                ubicacion: { select: { nombre: true, activo: true } },
            },
            orderBy: [{ nombre: 'asc' }, { tipo: 'asc' }],
        })
        return NextResponse.json(cajas)
    } catch (error) {
        console.error('Error obteniendo cajas para liquidaciones:', error)
        return NextResponse.json({ error: 'No se pudieron cargar las cajas de pago.' }, { status: 500 })
    }
}

