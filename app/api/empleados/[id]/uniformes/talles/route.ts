import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ErrorUniformes, validarTalle } from '@/lib/rrhh/uniformes'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar talles.' }, { status: 403 })
    try {
        const { id } = await params;
        const talles = await prisma.talleUniforme.findUnique({
            where: {
                empleadoId: id
            },
            select: { remera: true, buzo: true }
        })

        return NextResponse.json(talles || {})
    } catch {
        return NextResponse.json(
            { error: 'Error al obtener talles' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as { rol?: string } | undefined
        if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
        if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede modificar talles.' }, { status: 403 })
        const { id } = await params;
        const body = await request.json()
        const remera = body.remera ? validarTalle(body.remera) : null
        const buzo = body.buzo ? validarTalle(body.buzo) : null

        const talles = await prisma.talleUniforme.upsert({
            where: {
                empleadoId: id
            },
            update: {
                remera,
                buzo
            },
            create: {
                empleadoId: id,
                remera,
                buzo
            }
        })

        return NextResponse.json(talles)
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'Error al actualizar talles' },
            { status: error instanceof ErrorUniformes ? error.status : 500 }
        )
    }
}
