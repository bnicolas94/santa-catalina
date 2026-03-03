import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/lotes/:id — Actualizar lote
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const lote = await prisma.lote.update({
            where: { id },
            data: {
                ...(body.estado !== undefined && { estado: body.estado }),
                ...(body.horaFin !== undefined && { horaFin: body.horaFin ? new Date(body.horaFin) : null }),
                ...(body.unidadesProducidas !== undefined && { unidadesProducidas: parseInt(body.unidadesProducidas) }),
                ...(body.unidadesRechazadas !== undefined && { unidadesRechazadas: parseInt(body.unidadesRechazadas) }),
                ...(body.motivoRechazo !== undefined && { motivoRechazo: body.motivoRechazo || null }),
                ...(body.empleadosRonda !== undefined && { empleadosRonda: parseInt(body.empleadosRonda) }),
            },
            include: {
                producto: true,
                coordinador: { select: { id: true, nombre: true } },
            },
        })

        return NextResponse.json(lote)
    } catch (error) {
        console.error('Error updating lote:', error)
        return NextResponse.json({ error: 'Error al actualizar lote' }, { status: 500 })
    }
}
