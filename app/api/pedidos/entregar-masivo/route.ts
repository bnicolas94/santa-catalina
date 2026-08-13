import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { descontarStockPorPedido } from '@/lib/pedidos/stockPedido'

const ESTADOS_ABIERTOS = ['pendiente', 'confirmado', 'en_ruta']

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fechaDesde, fechaHasta, turno, search, canal, estado } = body

        if (!fechaDesde && !fechaHasta) {
            return NextResponse.json(
                { error: 'Seleccioná al menos una fecha para realizar la entrega masiva.' },
                { status: 400 },
            )
        }

        if (estado && !ESTADOS_ABIERTOS.includes(estado)) {
            return NextResponse.json({
                success: true,
                marcados: 0,
                descontados: 0,
                yaDescontados: 0,
                message: 'El filtro actual no contiene pedidos abiertos para entregar.',
            })
        }

        const where: Prisma.PedidoWhereInput = { estado: estado || { in: ESTADOS_ABIERTOS } }
        where.fechaEntrega = {}
        if (fechaDesde) where.fechaEntrega.gte = new Date(`${fechaDesde}T00:00:00.000Z`)
        if (fechaHasta) where.fechaEntrega.lte = new Date(`${fechaHasta}T23:59:59.999Z`)
        if (turno) where.turno = turno
        if (canal === 'local') where.esRetiro = true
        else if (canal === 'reparto') where.esRetiro = false
        if (search) where.cliente = { nombreComercial: { contains: search } }

        const resultado = await prisma.$transaction(async (tx) => {
            const pedidos = await tx.pedido.findMany({
                where,
                include: {
                    cliente: { select: { nombreComercial: true } },
                    detalles: {
                        include: {
                            presentacion: { select: { productoId: true } },
                        },
                    },
                    entregas: { select: { id: true, rutaId: true, horaEntrega: true } },
                },
            })

            if (pedidos.length === 0) {
                return { marcados: 0, descontados: 0, yaDescontados: 0 }
            }

            const [fabrica, local] = await Promise.all([
                tx.ubicacion.findFirst({ where: { tipo: 'FABRICA', activo: true }, select: { id: true } }),
                tx.ubicacion.findFirst({ where: { tipo: 'LOCAL', activo: true }, select: { id: true } }),
            ])

            let marcados = 0
            let descontados = 0
            let yaDescontados = 0
            const ahora = new Date()

            for (const pedido of pedidos) {
                const salioEnRuta = pedido.entregas.length > 0

                if (salioEnRuta) {
                    // La creación de la ruta ya descontó el stock. Solo cerramos las entregas pendientes.
                    await tx.entrega.updateMany({
                        where: { pedidoId: pedido.id, horaEntrega: null },
                        data: {
                            horaEntrega: ahora,
                            unidadesRechazadas: 0,
                            motivoRechazo: null,
                            observaciones: 'Entrega confirmada de forma masiva desde Pedidos',
                        },
                    })
                    yaDescontados++
                } else {
                    const ubicacionId = pedido.ubicacionId
                        || (pedido.esRetiro ? local?.id : fabrica?.id)

                    if (!ubicacionId) {
                        throw new Error(
                            `No hay una ubicación ${pedido.esRetiro ? 'LOCAL' : 'FABRICA'} activa para descontar el pedido de ${pedido.cliente.nombreComercial}.`,
                        )
                    }

                    const seDesconto = await descontarStockPorPedido(tx, pedido, ubicacionId, {
                        tipo: 'salida_pedido',
                        observaciones: `Entrega masiva del pedido ${pedido.id}`,
                    })
                    if (seDesconto) descontados++
                    else yaDescontados++
                }

                await tx.pedido.update({
                    where: { id: pedido.id },
                    data: { estado: 'entregado' },
                })
                marcados++
            }

            return { marcados, descontados, yaDescontados }
        }, { timeout: 30_000 })

        eventBus.emit('order-updated', { bulk: true, status: 'entregado' })

        return NextResponse.json({
            success: true,
            ...resultado,
            message: resultado.marcados === 0
                ? 'No había pedidos abiertos con los filtros seleccionados.'
                : `${resultado.marcados} pedido(s) marcados como entregados. ${resultado.descontados} descuento(s) de stock registrados por pedido.`,
        })
    } catch (error) {
        console.error('Error en entrega masiva de pedidos:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'No se pudo completar la entrega masiva.' },
            { status: 500 },
        )
    }
}
