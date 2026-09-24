import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ErrorUniformes } from '@/lib/rrhh/uniformes'
import { anularEntregaUniforme } from '@/lib/services/uniformes.service'

type Contexto = { params: Promise<{ id: string; entregaId: string }> }

export async function GET(_request: Request, { params }: Contexto) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar entregas.' }, { status: 403 })
    try {
        const { id, entregaId } = await params
        const entrega = await prisma.entregaUniforme.findUnique({
            where: { id: entregaId, empleadoId: id },
            select: {
                id: true, empleadoId: true, fecha: true, remera: true, buzo: true,
                observaciones: true, estado: true, createdAt: true,
                nombreEmpleado: true, dniEmpleado: true, rolEmpleado: true,
                detalles: { select: { prenda: true, talle: true, cantidad: true } },
                empleado: { select: { nombre: true, apellido: true, dni: true, rol: true } },
            },
        })
        if (!entrega) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
        return NextResponse.json(entrega)
    } catch {
        return NextResponse.json({ error: 'Error al obtener entrega' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: Contexto) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; rol?: string } | undefined
    if (!user?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede anular entregas.' }, { status: 403 })
    try {
        const { id, entregaId } = await params
        const existe = await prisma.entregaUniforme.findUnique({ where: { id: entregaId }, select: { empleadoId: true } })
        if (!existe || existe.empleadoId !== id) return NextResponse.json({ error: 'Entrega no encontrada.' }, { status: 404 })
        const body = await request.json()
        return NextResponse.json(await anularEntregaUniforme(entregaId, body.motivo, user.id))
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'No se pudo anular la entrega.' },
            { status: error instanceof ErrorUniformes ? error.status : 500 },
        )
    }
}
