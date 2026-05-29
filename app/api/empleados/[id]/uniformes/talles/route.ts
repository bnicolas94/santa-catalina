import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const talles = await prisma.talleUniforme.findUnique({
            where: {
                empleadoId: id
            }
        })

        return NextResponse.json(talles || {})
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Error al obtener talles', detalle: error.message },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json()

        const talles = await prisma.talleUniforme.upsert({
            where: {
                empleadoId: id
            },
            update: {
                remera: body.remera || null,
                buzo: body.buzo || null
            },
            create: {
                empleadoId: id,
                remera: body.remera || null,
                buzo: body.buzo || null
            }
        })

        return NextResponse.json(talles)
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Error al actualizar talles', detalle: error.message },
            { status: 500 }
        )
    }
}
