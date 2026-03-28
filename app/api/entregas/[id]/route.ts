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
            // 1. Obtener la entrega actual con su ruta para conocer el origen
            const entregaPrevia = await tx.entrega.findUnique({
                where: { id },
                include: { 
                    ruta: true,
                    pedido: { 
                        include: { 
                            detalles: {
                                include: { presentacion: true }
                            } 
                        } 
                    }
                }
            })

            if (!entregaPrevia) throw new Error("Entrega no encontrada")

            // 2. Actualizar la entrega
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

            // 3. Manejo de Stock por RECHAZO
            // Si hay unidades rechazadas, debemos devolverlas al stock de la ubicación de origen de la ruta
            if (upEntrega.unidadesRechazadas > 0 && entregaPrevia.ruta.ubicacionOrigenId) {
                const origenId = entregaPrevia.ruta.ubicacionOrigenId
                
                // NOTA: Para simplicidad, si hay rechazo parcial, distribuimos el rechazo proporcionalmente
                // o lo aplicamos a las presentaciones del pedido. 
                // En este sistema, asumimos que unidadesRechazadas se refiere al total de "paquetes".
                
                for (const detalle of entregaPrevia.pedido.detalles) {
                    if (!detalle.presentacion) continue;
                    
                    const factorRechazo = upEntrega.unidadesRechazadas / entregaPrevia.pedido.totalUnidades
                    const cantADevolver = Math.round(detalle.cantidad * factorRechazo)

                    if (cantADevolver > 0) {
                        await tx.stockProducto.upsert({
                            where: { 
                                productoId_presentacionId_ubicacionId: { 
                                    productoId: detalle.presentacion.productoId, 
                                    presentacionId: detalle.presentacionId, 
                                    ubicacionId: origenId 
                                } 
                            },
                            update: { cantidad: { increment: cantADevolver } },
                            create: { 
                                productoId: detalle.presentacion.productoId, 
                                presentacionId: detalle.presentacionId, 
                                ubicacionId: origenId, 
                                cantidad: cantADevolver 
                            }
                        })

                        await tx.movimientoProducto.create({
                            data: {
                                tipo: 'devolucion_rechazo',
                                cantidad: cantADevolver,
                                signo: 'entrada',
                                productoId: detalle.presentacion.productoId,
                                presentacionId: detalle.presentacionId,
                                ubicacionId: origenId,
                                entregaId: upEntrega.id,
                                observaciones: `Devolución por rechazo en entrega ${upEntrega.id}. Motivo: ${upEntrega.motivoRechazo}`
                            }
                        })
                    }
                }
            }

            // 4. Si las unidades rechazadas son iguales al total (rechazo total)
            const estadoPedido = upEntrega.unidadesRechazadas >= upEntrega.pedido.totalUnidades
                ? 'rechazado'
                : 'entregado'

            // 5. Actualizar estado del pedido relacionado
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
