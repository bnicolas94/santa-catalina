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
            // Si fue entrada (+), ahora restamos (-). Si fue salida (-), ahora sumamos (+).
            const delta = movimiento.tipo === 'entrada' ? -movimiento.cantidad : movimiento.cantidad

            await tx.insumo.update({
                where: { id: movimiento.insumoId },
                data: {
                    stockActual: { increment: delta }
                }
            })

            // 3. Si tiene un gasto asociado, eliminarlo
            if (movimiento.gastoId) {
                await tx.gastoOperativo.delete({
                    where: { id: movimiento.gastoId }
                })
            }

            // 4. Eliminar el movimiento
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
        const { insumoId, tipo, cantidad, observaciones, proveedorId, costoTotal, estadoPago, actualizarCosto, fechaVencimiento } = body

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
                        // Actualizar gasto existente
                        await tx.gastoOperativo.update({
                            where: { id: gastoId },
                            data: {
                                monto: nuevoCostoTotal,
                                descripcion: `Compra de Insumos (Editada) - ${observaciones || 'Directa'}`,
                                categoriaId: cat.id
                            }
                        })
                    } else {
                        // Crear nuevo gasto
                        const nuevoGasto = await tx.gastoOperativo.create({
                            data: {
                                fecha: new Date(),
                                monto: nuevoCostoTotal,
                                descripcion: `Compra de Insumos - ${observaciones || 'Directa'}`,
                                categoriaId: cat.id
                            }
                        })
                        gastoId = nuevoGasto.id
                    }
                } else if (nuevoEstado === 'pendiente' && gastoId) {
                    // Si pasó de pagado a pendiente, borramos el gasto
                    await tx.gastoOperativo.delete({ where: { id: gastoId } })
                    gastoId = null
                }
            } else if (gastoId) {
                // Si ya no es entrada o no tiene costo, borramos el gasto
                await tx.gastoOperativo.delete({ where: { id: gastoId } })
                gastoId = null
            }

            // 4. Actualizar Movimiento
            const movActualizado = await tx.movimientoStock.update({
                where: { id },
                data: {
                    insumoId,
                    tipo,
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
