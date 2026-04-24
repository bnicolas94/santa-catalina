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

        // Obtener estado actual para detectar transición
        const loteActual = await prisma.lote.findUnique({ where: { id } })
        if (!loteActual) {
            return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
        }

        const nuevoEstado = body.estado !== undefined ? body.estado : loteActual.estado

        const lote = await prisma.$transaction(async (tx) => {
            const updated = await tx.lote.update({
                where: { id },
                data: {
                    ...(body.estado !== undefined && { estado: body.estado }),
                    ...(body.horaFin !== undefined && { horaFin: body.horaFin ? new Date(body.horaFin) : null }),
                    ...(body.unidadesProducidas !== undefined && { unidadesProducidas: parseInt(body.unidadesProducidas) }),
                    ...(body.unidadesRechazadas !== undefined && { unidadesRechazadas: parseInt(body.unidadesRechazadas) }),
                    ...(body.motivoRechazo !== undefined && { motivoRechazo: body.motivoRechazo || null }),
                    ...(body.empleadosRonda !== undefined && { empleadosRonda: parseInt(body.empleadosRonda) }),
                    ...(body.fechaProduccion !== undefined && {
                        fechaProduccion: (() => {
                            const [y, m, d] = body.fechaProduccion.split('-').map(Number)
                            return new Date(Date.UTC(y, m - 1, d))
                        })()
                    }),
                    ...(body.coordinadorId !== undefined && { coordinadorId: body.coordinadorId || null }),
                    ...(body.distribucionPresentaciones !== undefined && { distribucion: body.distribucionPresentaciones }),
                },
                include: {
                    producto: { include: { presentaciones: true } },
                    coordinador: { select: { id: true, nombre: true } },
                    ubicacion: { select: { id: true, nombre: true } },
                    _count: { select: { detallePedidos: true } },
                    movimientosProducto: {
                        where: { tipo: 'produccion', signo: 'entrada' },
                        select: { presentacionId: true, cantidad: true }
                    }
                },
            })

            // Revertir stock si el lote ya estaba en un estado que sumaba stock
            if (loteActual.estado !== 'en_produccion') {
                const movimientos = await tx.movimientoProducto.findMany({
                    where: { loteId: id, tipo: 'produccion', signo: 'entrada' }
                })

                for (const mov of movimientos) {
                    await tx.stockProducto.upsert({
                        where: { productoId_presentacionId_ubicacionId: { productoId: mov.productoId, presentacionId: mov.presentacionId, ubicacionId: mov.ubicacionId } },
                        create: { productoId: mov.productoId, presentacionId: mov.presentacionId, ubicacionId: mov.ubicacionId, cantidad: 0 },
                        update: { cantidad: { decrement: mov.cantidad } },
                    })
                }

                await tx.movimientoProducto.deleteMany({
                    where: { loteId: id, tipo: 'produccion', signo: 'entrada' },
                })
            }

            // Aplicar stock si el nuevo estado suma stock
            if (nuevoEstado !== 'en_produccion') {
                const distribucion = body.distribucionPresentaciones || []

                if (distribucion.length > 0) {
                    for (const { presentacionId, cantidad } of distribucion) {
                        if (cantidad <= 0) continue
                        await tx.stockProducto.upsert({
                            where: { productoId_presentacionId_ubicacionId: { productoId: updated.productoId, presentacionId, ubicacionId: body.ubicacionId || updated.ubicacionId } },
                            create: { productoId: updated.productoId, presentacionId, ubicacionId: body.ubicacionId || updated.ubicacionId, cantidad: Number(cantidad) },
                            update: { cantidad: { increment: Number(cantidad) } },
                        })

                        await tx.movimientoProducto.create({
                            data: {
                                productoId: updated.productoId,
                                presentacionId,
                                tipo: 'produccion',
                                cantidad: Number(cantidad),
                                ubicacionId: body.ubicacionId || updated.ubicacionId,
                                signo: 'entrada',
                                observaciones: `Producción finalizada — Lote ${id}`,
                                loteId: id,
                            },
                        })
                    }
                } else {
                    const qty = updated.unidadesProducidas
                    const presentacion = await tx.presentacion.findFirst({
                        where: { productoId: updated.productoId },
                        orderBy: { cantidad: 'desc' }
                    })

                    if (presentacion) {
                        await tx.stockProducto.upsert({
                            where: { productoId_presentacionId_ubicacionId: { productoId: updated.productoId, presentacionId: presentacion.id, ubicacionId: body.ubicacionId || updated.ubicacionId } },
                            create: { productoId: updated.productoId, presentacionId: presentacion.id, ubicacionId: body.ubicacionId || updated.ubicacionId, cantidad: qty },
                            update: { cantidad: { increment: qty } },
                        })

                        await tx.movimientoProducto.create({
                            data: {
                                productoId: updated.productoId,
                                presentacionId: presentacion.id,
                                tipo: 'produccion',
                                cantidad: qty,
                                ubicacionId: body.ubicacionId || updated.ubicacionId,
                                signo: 'entrada',
                                observaciones: `Producción finalizada — Lote ${id}`,
                                loteId: id,
                            },
                        })
                    }
                }
            }

            // ─── Descuento automático de insumos (ficha técnica) ───

            // 1. Revertir descuentos previos de insumos vinculados a este lote
            const movsInsumo = await tx.movimientoStock.findMany({
                where: { loteOrigenId: id, tipo: 'salida' }
            })
            if (movsInsumo.length > 0) {
                // Revertir stock en paralelo + eliminar movimientos
                await Promise.all([
                    // Eliminar movimientos viejos
                    tx.movimientoStock.deleteMany({ where: { loteOrigenId: id, tipo: 'salida' } }),
                    // Revertir cada insumo en paralelo
                    ...movsInsumo.map(mov => tx.insumo.update({
                        where: { id: mov.insumoId },
                        data: { stockActual: { increment: mov.cantidad } }
                    })),
                    // Revertir stock por ubicación en paralelo
                    ...movsInsumo.filter(m => m.ubicacionId).map(mov => tx.stockInsumo.upsert({
                        where: { insumoId_ubicacionId: { insumoId: mov.insumoId, ubicacionId: mov.ubicacionId! } },
                        create: { insumoId: mov.insumoId, ubicacionId: mov.ubicacionId!, cantidad: mov.cantidad },
                        update: { cantidad: { increment: mov.cantidad } }
                    }))
                ])
            }

            // 2. Aplicar nuevo descuento si el estado final NO es en_produccion
            if (nuevoEstado !== 'en_produccion') {
                const fichas = await tx.fichaTecnica.findMany({
                    where: { productoId: updated.productoId }
                })
                const ubicId = body.ubicacionId || updated.ubicacionId
                const consumos = fichas
                    .map(f => ({ insumoId: f.insumoId, consumo: f.cantidadPorUnidad * updated.unidadesProducidas }))
                    .filter(c => c.consumo > 0)

                if (consumos.length > 0) {
                    await Promise.all([
                        // Crear todos los movimientos de stock en batch
                        tx.movimientoStock.createMany({
                            data: consumos.map(c => ({
                                insumoId: c.insumoId,
                                tipo: 'salida',
                                cantidad: c.consumo,
                                observaciones: `Consumo automático — Lote ${id}`,
                                loteOrigenId: id,
                                ubicacionId: ubicId,
                            }))
                        }),
                        // Decrementar stock de cada insumo en paralelo
                        ...consumos.map(c => tx.insumo.update({
                            where: { id: c.insumoId },
                            data: { stockActual: { decrement: c.consumo } }
                        })),
                        // Actualizar stock por ubicación en paralelo
                        ...consumos.map(c => tx.stockInsumo.upsert({
                            where: { insumoId_ubicacionId: { insumoId: c.insumoId, ubicacionId: ubicId } },
                            create: { insumoId: c.insumoId, ubicacionId: ubicId, cantidad: -c.consumo },
                            update: { cantidad: { decrement: c.consumo } }
                        }))
                    ])
                }
            }

            return updated
        }, { timeout: 30000 })

        return NextResponse.json(lote)
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack : ''
        console.error('Error updating lote:', msg)
        console.error('Stack:', stack)
        return NextResponse.json({ error: `Error al actualizar lote: ${msg}` }, { status: 500 })
    }
}

// DELETE /api/lotes/:id — Eliminar lote y revertir stock
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Obtener lote con su info para revertir
        const lote = await prisma.lote.findUnique({
            where: { id },
            include: {
                movimientosStock: true,
                movimientosProducto: true,
            },
        })

        if (!lote) {
            return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
        }

        await prisma.$transaction(async (tx) => {
            // 1. Revertir stock de insumos (las salidas automáticas de la producción)
            for (const mov of lote.movimientosStock) {
                if (mov.tipo === 'salida') {
                    // Devolver el insumo que se consumió
                    await tx.insumo.update({
                        where: { id: mov.insumoId },
                        data: { stockActual: { increment: mov.cantidad } },
                    })
                }
            }
            // Eliminar movimientos de stock del lote
            await tx.movimientoStock.deleteMany({ where: { loteOrigenId: id } })

            // 2. Revertir stock de producto terminado
            for (const mov of lote.movimientosProducto) {
                if (mov.signo === 'entrada') {
                    // Restar lo que se sumó por producción
                    await tx.stockProducto.update({
                        where: { productoId_presentacionId_ubicacionId: { productoId: mov.productoId, presentacionId: mov.presentacionId, ubicacionId: mov.ubicacionId } },
                        data: { cantidad: { decrement: mov.cantidad } },
                    })
                }
            }
            // Eliminar movimientos de producto del lote
            await tx.movimientoProducto.deleteMany({ where: { loteId: id } })

            // 3. Eliminar detalles de pedido vinculados al lote (desvincular)
            await tx.detallePedido.updateMany({
                where: { loteId: id },
                data: { loteId: null },
            })

            // 4. Eliminar el lote
            await tx.lote.delete({ where: { id } })
        })

        return NextResponse.json({ ok: true, mensaje: `Lote ${id} eliminado y stock revertido` })
    } catch (error) {
        console.error('Error deleting lote:', error)
        return NextResponse.json({ error: 'Error al eliminar lote' }, { status: 500 })
    }
}
