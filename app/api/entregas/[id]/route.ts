import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/entregas/:id — Actualizar entrega por el repartidor
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const entregaActualizada = await prisma.$transaction(async (tx) => {
            // 1. Actualizar la entrega
            const upEntrega = await tx.entrega.update({
                where: { id },
                data: {
                    horaEntrega: new Date(),
                    tempEntrega: body.tempEntrega !== undefined ? parseFloat(body.tempEntrega) : null,
                    unidadesRechazadas: body.unidadesRechazadas !== undefined ? parseInt(body.unidadesRechazadas) : 0,
                    motivoRechazo: body.motivoRechazo || null,
                    observaciones: body.observaciones || null,
                },
                include: { pedido: true }
            })

            // 2. Si las unidades rechazadas son iguales al total (rechazo total)
            const estadoPedido = upEntrega.unidadesRechazadas >= upEntrega.pedido.totalUnidades
                ? 'rechazado'
                : 'entregado'

            // 3. Actualizar estado del pedido relacionado
            await tx.pedido.update({
                where: { id: upEntrega.pedidoId },
                data: { estado: estadoPedido }
            })

            return upEntrega
        })

        return NextResponse.json(entregaActualizada)
    } catch (error) {
        console.error('Error updating entrega:', error)
        return NextResponse.json({ error: 'Error al registrar entrega' }, { status: 500 })
    }
}
