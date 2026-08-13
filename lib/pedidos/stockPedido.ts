import type { Prisma } from '@prisma/client'

type DetalleParaStock = {
    cantidad: number
    presentacionId: string
    presentacion: { productoId: string }
}

export function consolidarDetallesPedido(detalles: DetalleParaStock[]) {
    const consolidado = new Map<string, { productoId: string; cantidad: number }>()

    for (const detalle of detalles) {
        const actual = consolidado.get(detalle.presentacionId)
        if (actual) {
            actual.cantidad += detalle.cantidad
        } else {
            consolidado.set(detalle.presentacionId, {
                productoId: detalle.presentacion.productoId,
                cantidad: detalle.cantidad,
            })
        }
    }

    return consolidado
}

export async function descontarStockPorPedido(
    tx: Prisma.TransactionClient,
    pedido: { id: string; detalles: DetalleParaStock[] },
    ubicacionId: string,
    opciones: { tipo: 'salida_pedido' | 'salida_ruta'; rutaId?: string; observaciones: string },
) {
    const existente = await tx.movimientoProducto.findFirst({
        where: {
            pedidoId: pedido.id,
            tipo: { in: ['salida_pedido', 'salida_ruta'] },
        },
        select: { id: true },
    })

    if (existente) return false

    const consolidado = consolidarDetallesPedido(pedido.detalles)

    for (const [presentacionId, item] of consolidado) {
        if (item.cantidad <= 0) continue

        await tx.stockProducto.upsert({
            where: {
                productoId_presentacionId_ubicacionId: {
                    productoId: item.productoId,
                    presentacionId,
                    ubicacionId,
                },
            },
            update: { cantidad: { decrement: item.cantidad } },
            create: {
                productoId: item.productoId,
                presentacionId,
                ubicacionId,
                cantidad: -item.cantidad,
            },
        })

        await tx.movimientoProducto.create({
            data: {
                tipo: opciones.tipo,
                cantidad: item.cantidad,
                signo: 'salida',
                productoId: item.productoId,
                presentacionId,
                ubicacionId,
                pedidoId: pedido.id,
                rutaId: opciones.rutaId,
                observaciones: opciones.observaciones,
            },
        })
    }

    return true
}
