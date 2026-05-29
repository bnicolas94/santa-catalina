import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const entregas = await prisma.entregaUniforme.findMany({
            where: {
                empleadoId: id
            },
            orderBy: {
                fecha: 'desc'
            }
        })

        return NextResponse.json(entregas)
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Error al obtener historial de entregas', detalle: error.message },
            { status: 500 }
        )
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json()
        const { remera, buzo, observaciones, fecha } = body

        const entrega = await prisma.entregaUniforme.create({
            data: {
                empleadoId: id,
                remera: Number(remera) || 0,
                buzo: Number(buzo) || 0,
                observaciones,
                fecha: fecha ? new Date(fecha) : new Date()
            }
        })

        return NextResponse.json(entrega, { status: 201 })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Error al registrar entrega', detalle: error.message },
            { status: 500 }
        )
    }
}
