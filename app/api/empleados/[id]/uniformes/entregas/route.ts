import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ErrorUniformes } from '@/lib/rrhh/uniformes'
import { crearEntregaUniforme } from '@/lib/services/uniformes.service'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar entregas.' }, { status: 403 })
    try {
        const { id } = await params
        const entregas = await prisma.entregaUniforme.findMany({
            where: { empleadoId: id },
            orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
            select: {
                id: true, fecha: true, remera: true, buzo: true, observaciones: true,
                estado: true, createdAt: true, motivoAnulacion: true,
                registradoPor: { select: { nombre: true, apellido: true } },
                detalles: { select: { prenda: true, talle: true, cantidad: true } },
            },
        })
        return NextResponse.json(entregas)
    } catch {
        return NextResponse.json({ error: 'Error al obtener historial de entregas' }, { status: 500 })
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; rol?: string } | undefined
    if (!user?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede registrar entregas.' }, { status: 403 })
    try {
        const { id } = await params
        const body = await request.json()
        const entrega = await crearEntregaUniforme({ ...body, empleadoId: id }, user.id)
        return NextResponse.json({ id: entrega.id }, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'No se pudo registrar la entrega.' },
            { status: error instanceof ErrorUniformes ? error.status : 500 },
        )
    }
}
