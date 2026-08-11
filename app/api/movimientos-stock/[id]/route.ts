import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'
import { ComprasService } from '@/lib/services/compras.service'
import {
    CompraValidationError,
    estadoPagoDesdeMontos,
    numeroNoNegativo,
    numeroPositivo,
    validarMontoPagado,
} from '@/lib/compras/validacion'

type TxClient = Prisma.TransactionClient

type StockDelta = {
    insumoId: string
    ubicacionId: string | null
    cantidad: number
    cantidadSecundaria: number
    tipo: string
}

function fechaCivil(value: unknown, fallback: Date): Date {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00Z`)
        : fallback
}

async function aplicarStock(tx: TxClient, movimiento: StockDelta, factor: 1 | -1) {
    const signoTipo = movimiento.tipo === 'entrada' ? 1 : -1
    const delta = factor * signoTipo * movimiento.cantidad
    const deltaSecundario = factor * signoTipo * movimiento.cantidadSecundaria
    await tx.insumo.update({
        where: { id: movimiento.insumoId },
        data: {
            stockActual: { increment: delta },
            stockActualSecundario: { increment: deltaSecundario },
        },
    })
    if (movimiento.ubicacionId) {
        await tx.stockInsumo.upsert({
            where: {
                insumoId_ubicacionId: {
                    insumoId: movimiento.insumoId,
                    ubicacionId: movimiento.ubicacionId,
                },
            },
            update: {
                cantidad: { increment: delta },
                cantidadSecundaria: { increment: deltaSecundario },
            },
            create: {
                insumoId: movimiento.insumoId,
                ubicacionId: movimiento.ubicacionId,
                cantidad: delta,
                cantidadSecundaria: deltaSecundario,
            },
        })
    }
}

// DELETE /api/movimientos-stock/[id]
// Si el movimiento pertenece a una compra, elimina la factura completa.
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.$transaction(async tx => {
            const movimiento = await tx.movimientoStock.findUnique({ where: { id } })
            if (!movimiento) throw new CompraValidationError('Movimiento no encontrado')

            if (movimiento.compraId) {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'compra:' + movimiento.compraId}))::text AS lock_result`
                const items = await tx.movimientoStock.findMany({ where: { compraId: movimiento.compraId } })
                for (const item of items) {
                    await aplicarStock(tx, {
                        insumoId: item.insumoId,
                        ubicacionId: item.ubicacionId,
                        cantidad: item.cantidad,
                        cantidadSecundaria: item.cantidadSecundaria || 0,
                        tipo: item.tipo,
                    }, -1)
                }

                await ComprasService.revertirFinanzasCompraEnTx(tx, movimiento.compraId)
                await tx.movimientoStock.deleteMany({ where: { compraId: movimiento.compraId } })
                await tx.compra.delete({ where: { id: movimiento.compraId } })
                return
            }

            // Compatibilidad defensiva para movimientos antiguos aún sin cabecera.
            if (!movimiento.compraId) {
                throw new CompraValidationError('Las facturas históricas son de solo lectura y no pueden eliminarse')
            }
            if (movimiento.gastoId) {
                const asociados = await tx.movimientoStock.count({ where: { gastoId: movimiento.gastoId } })
                if (asociados > 1) {
                    throw new CompraValidationError('Este movimiento histórico comparte un pago con otros ítems y no puede eliminarse individualmente')
                }
                const cajas = await tx.movimientoCaja.findMany({
                    where: { gastoId: movimiento.gastoId },
                    select: { id: true },
                })
                for (const caja of cajas) await CajaService.revertirMovimientoEnTx(tx, caja.id)
            }
            await aplicarStock(tx, {
                insumoId: movimiento.insumoId,
                ubicacionId: movimiento.ubicacionId,
                cantidad: movimiento.cantidad,
                cantidadSecundaria: movimiento.cantidadSecundaria || 0,
                tipo: movimiento.tipo,
            }, -1)
            const gastoId = movimiento.gastoId
            await tx.movimientoStock.delete({ where: { id } })
            if (gastoId) await tx.gastoOperativo.delete({ where: { id: gastoId } })
        })

        return NextResponse.json({ message: 'Compra eliminada; stock y caja fueron revertidos' })
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error eliminando compra:', error)
        return NextResponse.json({ error: 'Error al eliminar la compra' }, { status: 500 })
    }
}

// PATCH /api/movimientos-stock/[id]
// Edita el ítem sin inventar ni revertir pagos. El estado se deriva de los montos reales.
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json() as Record<string, unknown>
        const result = await prisma.$transaction(async tx => {
            const original = await tx.movimientoStock.findUnique({ where: { id } })
            if (!original) throw new CompraValidationError('Movimiento no encontrado')
            if (!original.compraId) {
                throw new CompraValidationError('Las facturas históricas son de solo lectura y no pueden editarse')
            }

            const tipo = String(body.tipo || original.tipo)
            if (tipo !== original.tipo) throw new CompraValidationError('No se puede cambiar el tipo de un movimiento existente')
            const insumoId = String(body.insumoId || original.insumoId)
            const ubicacionId = String(body.ubicacionId || original.ubicacionId || '') || null
            if (!insumoId || !ubicacionId) throw new CompraValidationError('Seleccione insumo y ubicación')
            const cantidad = numeroPositivo(body.cantidad, 'Cantidad')
            const cantidadSecundaria = body.cantidadSecundaria
                ? numeroPositivo(body.cantidadSecundaria, 'Cantidad secundaria')
                : 0
            const costoTotal = body.costoTotal === '' || body.costoTotal === undefined
                ? null
                : numeroNoNegativo(body.costoTotal, 'Costo total')
            const proveedorId = String(body.proveedorId || '') || null
            const fechaMovimiento = fechaCivil(body.fechaMovimiento, original.fecha)
            const fechaFactura = body.fechaFactura ? fechaCivil(body.fechaFactura, original.fecha) : null
            const fechaVencimiento = body.fechaVencimiento ? fechaCivil(body.fechaVencimiento, original.fecha) : null
            const observaciones = String(body.observaciones || '').trim() || null

            const compraItems = original.compraId
                ? await tx.movimientoStock.findMany({ where: { compraId: original.compraId } })
                : [original]
            for (const item of compraItems) {
                await aplicarStock(tx, {
                    insumoId: item.insumoId,
                    ubicacionId: item.ubicacionId,
                    cantidad: item.cantidad,
                    cantidadSecundaria: item.cantidadSecundaria || 0,
                    tipo: item.tipo,
                }, -1)
            }

            const actualizados = compraItems.map(item => item.id === id
                ? {
                    ...item,
                    insumoId,
                    ubicacionId,
                    cantidad,
                    cantidadSecundaria,
                    costoTotal,
                    proveedorId,
                    fecha: fechaMovimiento,
                    fechaFactura,
                    fechaVencimiento,
                    observaciones,
                }
                : {
                    ...item,
                    ubicacionId,
                    proveedorId,
                    fecha: fechaMovimiento,
                    fechaFactura,
                    observaciones,
                })

            for (const item of actualizados) {
                await aplicarStock(tx, {
                    insumoId: item.insumoId,
                    ubicacionId: item.ubicacionId,
                    cantidad: item.cantidad,
                    cantidadSecundaria: item.cantidadSecundaria || 0,
                    tipo: item.tipo,
                }, 1)
            }

            await tx.movimientoStock.update({
                where: { id },
                data: {
                    insumoId,
                    cantidad,
                    cantidadSecundaria,
                    costoTotal,
                    proveedorId,
                    fecha: fechaMovimiento,
                    fechaFactura,
                    fechaVencimiento,
                    ubicacionId,
                    observaciones,
                },
            })

            if (original.compraId) {
                await tx.movimientoStock.updateMany({
                    where: { compraId: original.compraId },
                    data: {
                        proveedorId,
                        ubicacionId,
                        fecha: fechaMovimiento,
                        fechaFactura,
                        observaciones,
                    },
                })
                const itemsNuevos = await tx.movimientoStock.findMany({
                    where: { compraId: original.compraId },
                    select: { id: true, costoTotal: true, montoPagado: true },
                })
                const nuevoTotal = itemsNuevos.reduce((acc, item) => acc + (item.costoTotal || 0), 0)
                const pagadoActual = itemsNuevos.reduce((acc, item) => acc + (item.montoPagado || 0), 0)
                validarMontoPagado(nuevoTotal, pagadoActual)
                const estadoPago = estadoPagoDesdeMontos(nuevoTotal, pagadoActual)
                for (const item of itemsNuevos) {
                    const montoItem = nuevoTotal > 0 ? pagadoActual * ((item.costoTotal || 0) / nuevoTotal) : 0
                    await tx.movimientoStock.update({
                        where: { id: item.id },
                        data: { montoPagado: montoItem, estadoPago },
                    })
                }
                await tx.compra.update({
                    where: { id: original.compraId },
                    data: {
                        proveedorId,
                        ubicacionId,
                        fechaMovimiento,
                        fechaFactura,
                        observaciones,
                        costoTotal: nuevoTotal,
                        montoPagado: pagadoActual,
                        estadoPago,
                    },
                })
            }

            if (tipo === 'entrada' && costoTotal && body.actualizarCosto === true) {
                await tx.insumo.update({
                    where: { id: insumoId },
                    data: { precioUnitario: costoTotal / cantidad },
                })
            }

            return tx.movimientoStock.findUnique({
                where: { id },
                include: {
                    insumo: { select: { id: true, nombre: true, unidadMedida: true, unidadSecundaria: true } },
                    proveedor: { select: { id: true, nombre: true } },
                    ubicacion: { select: { id: true, nombre: true } },
                    compra: true,
                },
            })
        })

        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof CompraValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error actualizando compra:', error)
        return NextResponse.json({ error: 'Error al actualizar la compra' }, { status: 500 })
    }
}
