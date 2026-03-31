import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// DELETE /api/movimientos-stock/[id]
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. Buscar el movimiento para saber qué revertir
        const movimiento = await prisma.movimientoStock.findUnique({
            where: { id },
        })

        if (!movimiento) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        await prisma.$transaction(async (tx) => {
            // 2. Revertir el stock en el Insumo
            const delta = movimiento.tipo === 'entrada' ? -movimiento.cantidad : movimiento.cantidad
            const deltaSec = movimiento.cantidadSecundaria ? (movimiento.tipo === 'entrada' ? -movimiento.cantidadSecundaria : movimiento.cantidadSecundaria) : 0

            await tx.insumo.update({
                where: { id: movimiento.insumoId },
                data: {
                    stockActual: { increment: delta },
                    stockActualSecundario: { increment: deltaSec }
                }
            })

            // 3. Revertir el stock en la Ubicación específica
            await tx.stockInsumo.updateMany({
                where: { insumoId: movimiento.insumoId, ubicacionId: movimiento.ubicacionId as string },
                data: {
                    cantidad: { increment: delta },
                    cantidadSecundaria: { increment: deltaSec }
                }
            })

            // 4. Si tiene un gasto asociado, verificar si hay otros ítems en esa factura
            if (movimiento.gastoId) {
                const countAsociados = await tx.movimientoStock.count({ where: { gastoId: movimiento.gastoId } })
                if (countAsociados <= 1) {
                    // Es el único o último ítem, borramos todo
                    await tx.movimientoCaja.deleteMany({ where: { gastoId: movimiento.gastoId } })
                    await tx.gastoOperativo.delete({ where: { id: movimiento.gastoId } })
                } else if (movimiento.costoTotal) {
                    // Hay otros ítems, solo restamos este monto de la caja y el gasto
                    await tx.gastoOperativo.update({ where: { id: movimiento.gastoId }, data: { monto: { decrement: movimiento.costoTotal } } })
                    await tx.movimientoCaja.updateMany({ where: { gastoId: movimiento.gastoId }, data: { monto: { decrement: movimiento.costoTotal } } })
                }
            }

            // 5. Eliminar el movimiento
            await tx.movimientoStock.delete({
                where: { id }
            })
        })

        return NextResponse.json({ message: 'Movimiento eliminado y stock revertido correctamente' })
    } catch (error) {
        console.error('Error eliminando movimiento de stock:', error)
        return NextResponse.json({ error: 'Error al eliminar el movimiento' }, { status: 500 })
    }
}

// PATCH /api/movimientos-stock/[id]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { insumoId, tipo, cantidad, observaciones, proveedorId, costoTotal, estadoPago, actualizarCosto, fechaVencimiento, fechaMovimiento } = body

        // 1. Buscar el movimiento original
        const movOriginal = await prisma.movimientoStock.findUnique({
            where: { id },
        })

        if (!movOriginal) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        const nuevaCant = parseFloat(cantidad)
        const nuevoCostoTotal = costoTotal ? parseFloat(costoTotal) : null
        const nuevoEstado = tipo === 'entrada' ? (estadoPago || 'pagado') : null
        
        const parsedFecha = fechaMovimiento ? new Date(`${fechaMovimiento}T12:00:00Z`) : movOriginal.fecha

        const result = await prisma.$transaction(async (tx) => {
            // 2. Compensar Stock
            // Cantidad vieja (con signo): entrada es +, salida es -
            const cantViejaSigno = movOriginal.tipo === 'entrada' ? movOriginal.cantidad : -movOriginal.cantidad
            // Cantidad nueva (con signo):
            const cantNuevaSigno = tipo === 'entrada' ? nuevaCant : -nuevaCant
            // Diferencia a aplicar: nuevo - viejo
            const deltaStock = cantNuevaSigno - cantViejaSigno

            if (deltaStock !== 0 || movOriginal.insumoId !== insumoId) {
                // Si cambió el insumo, revertimos el viejo y aplicamos al nuevo
                if (movOriginal.insumoId !== insumoId) {
                    await tx.insumo.update({
                        where: { id: movOriginal.insumoId },
                        data: { stockActual: { increment: -cantViejaSigno } }
                    })
                    await tx.insumo.update({
                        where: { id: insumoId },
                        data: { stockActual: { increment: cantNuevaSigno } }
                    })
                } else {
                    await tx.insumo.update({
                        where: { id: insumoId },
                        data: { stockActual: { increment: deltaStock } }
                    })
                }
            }

            // 3. Sincronizar Gasto Operativo
            let gastoId = movOriginal.gastoId

            if (tipo === 'entrada' && nuevoCostoTotal) {
                if (nuevoEstado === 'pagado') {
                    // Buscar o crear categoria "Proveedores"
                    let cat = await tx.categoriaGasto.findUnique({ where: { nombre: 'Proveedores' } })
                    if (!cat) {
                        cat = await tx.categoriaGasto.create({ data: { nombre: 'Proveedores', color: '#3498DB' } })
                    }

                    if (gastoId) {
                        // Actualizar gasto existente mediante incremento de la diferencia
                        const deltaCosto = nuevoCostoTotal - (movOriginal.costoTotal || 0)
                        await tx.gastoOperativo.update({
                            where: { id: gastoId },
                            data: {
                                fecha: parsedFecha,
                                monto: { increment: deltaCosto },
                                categoriaId: cat.id
                            }
                        })
                        // Actualizar fecha en caja asociada
                        await tx.movimientoCaja.updateMany({
                            where: { gastoId: gastoId },
                            data: { 
                                fecha: parsedFecha,
                                monto: { increment: deltaCosto }
                            }
                        })
                    } else {
                        // Crear nuevo gasto
                        const nuevoGasto = await tx.gastoOperativo.create({
                            data: {
                                fecha: parsedFecha,
                                monto: nuevoCostoTotal,
                                descripcion: `Compra de Insumos - ${observaciones || 'Directa'}`,
                                categoriaId: cat.id
                            }
                        })
                        gastoId = nuevoGasto.id
                    }
                } else if (nuevoEstado === 'pendiente' && gastoId) {
                    // Si pasó de pagado a pendiente, debemos remover su costo del Gasto Operativo o borrarlo si era el último
                    const countAsociados = await tx.movimientoStock.count({ where: { gastoId } })
                    if (countAsociados <= 1) {
                        await tx.movimientoCaja.deleteMany({ where: { gastoId } })
                        await tx.gastoOperativo.delete({ where: { id: gastoId } })
                    } else if (movOriginal.costoTotal) {
                        await tx.gastoOperativo.update({ where: { id: gastoId }, data: { monto: { decrement: movOriginal.costoTotal } } })
                        await tx.movimientoCaja.updateMany({ where: { gastoId }, data: { monto: { decrement: movOriginal.costoTotal } } })
                    }
                    gastoId = null
                }
            } else if (gastoId) {
                // Si ya no es entrada o no tiene costo, borramos el item del gasto
                const countAsociados = await tx.movimientoStock.count({ where: { gastoId } })
                if (countAsociados <= 1) {
                    await tx.movimientoCaja.deleteMany({ where: { gastoId } })
                    await tx.gastoOperativo.delete({ where: { id: gastoId } })
                } else if (movOriginal.costoTotal) {
                    await tx.gastoOperativo.update({ where: { id: gastoId }, data: { monto: { decrement: movOriginal.costoTotal } } })
                    await tx.movimientoCaja.updateMany({ where: { gastoId }, data: { monto: { decrement: movOriginal.costoTotal } } })
                }
                gastoId = null
            }

            // 4. Actualizar Movimiento
            const movActualizado = await tx.movimientoStock.update({
                where: { id },
                data: {
                    insumoId,
                    tipo,
                    fecha: parsedFecha,
                    cantidad: nuevaCant,
                    observaciones: observaciones || null,
                    proveedorId: proveedorId || null,
                    costoTotal: nuevoCostoTotal,
                    estadoPago: nuevoEstado,
                    fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
                    gastoId
                },
                include: {
                    insumo: { select: { id: true, nombre: true, unidadMedida: true } },
                    proveedor: { select: { id: true, nombre: true } },
                }
            })

            // 5. Actualizar precio unitario si se solicitó
            if (tipo === 'entrada' && nuevoCostoTotal && actualizarCosto && nuevaCant > 0) {
                await tx.insumo.update({
                    where: { id: insumoId },
                    data: { precioUnitario: nuevoCostoTotal / nuevaCant }
                })
            }

            return movActualizado
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error actualizando movimiento de stock:', error)
        return NextResponse.json({ error: 'Error al actualizar el movimiento' }, { status: 500 })
    }
}
