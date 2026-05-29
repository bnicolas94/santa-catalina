import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string, entregaId: string }> }
) {
    try {
        const { id, entregaId } = await params;
        const entrega = await prisma.entregaUniforme.findUnique({
            where: {
                id: entregaId,
                empleadoId: id
            },
            include: {
                empleado: {
                    include: {
                        talleUniforme: true
                    }
                }
            }
        })

        if (!entrega) {
            return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 })
        }

        return NextResponse.json(entrega)
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Error al obtener entrega', detalle: error.message },
            { status: 500 }
        )
    }
}
