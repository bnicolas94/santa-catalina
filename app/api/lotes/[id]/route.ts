import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { calcularConsumosProduccion, conciliarConsumoLote } from '@/lib/services/produccion-insumos'
import { calcularResultadoProduccion } from '@/lib/produccion/resultado-produccion'

class LoteValidationError extends Error {}

type ObjetivoProductoLote = {
    productoId: string
    presentacionId: string
    ubicacionId: string
    cantidad: number
}

async function conciliarProductoTerminadoLote(
    tx: Prisma.TransactionClient,
    loteId: string,
    objetivos: ObjetivoProductoLote[],
    motivo: 'correccion' | 'anulacion' = 'correccion',
) {
    const movimientos = await tx.movimientoProducto.findMany({ where: { loteId } })
    const saldos = new Map<string, ObjetivoProductoLote>()

    for (const movimiento of movimientos) {
        const key = `${movimiento.productoId}|${movimiento.presentacionId}|${movimiento.ubicacionId}`
        const actual = saldos.get(key) || {
            productoId: movimiento.productoId,
            presentacionId: movimiento.presentacionId,
            ubicacionId: movimiento.ubicacionId,
            cantidad: 0,
        }
        actual.cantidad += movimiento.signo === 'entrada' ? movimiento.cantidad : -movimiento.cantidad
        saldos.set(key, actual)
    }

    const metas = new Map<string, ObjetivoProductoLote>()
    for (const objetivo of objetivos) {
        const key = `${objetivo.productoId}|${objetivo.presentacionId}|${objetivo.ubicacionId}`
        metas.set(key, objetivo)
    }

    for (const key of new Set([...saldos.keys(), ...metas.keys()])) {
        const actual = saldos.get(key)?.cantidad || 0
        const objetivo = metas.get(key)?.cantidad || 0
        const delta = objetivo - actual
        if (delta === 0) continue

        const referencia = metas.get(key) || saldos.get(key)
        if (!referencia) continue

        await tx.stockProducto.upsert({
            where: {
                productoId_presentacionId_ubicacionId: {
                    productoId: referencia.productoId,
                    presentacionId: referencia.presentacionId,
                    ubicacionId: referencia.ubicacionId,
                },
            },
            create: { ...referencia, cantidad: delta },
            update: { cantidad: { increment: delta } },
        })

        await tx.movimientoProducto.create({
            data: {
                productoId: referencia.productoId,
                presentacionId: referencia.presentacionId,
                ubicacionId: referencia.ubicacionId,
                loteId,
                tipo: delta > 0 ? 'produccion' : motivo === 'anulacion' ? 'anulacion_produccion' : 'ajuste_produccion',
                signo: delta > 0 ? 'entrada' : 'salida',
                cantidad: Math.abs(delta),
                observaciones: motivo === 'anulacion'
                    ? `Anulación de producción — Lote ${loteId}`
                    : `Conciliación de producto terminado — Lote ${loteId}`,
            },
        })
    }
}

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
        if (loteActual.estado === 'cancelado') {
            return NextResponse.json({ error: 'Un lote anulado no puede modificarse' }, { status: 400 })
        }

        const nuevoEstado = body.estado !== undefined ? body.estado : loteActual.estado

        for (const [campo, valor] of [
            ['unidadesProducidas', body.unidadesProducidas],
            ['unidadesRechazadas', body.unidadesRechazadas],
        ] as const) {
            if (valor !== undefined && (!Number.isInteger(Number(valor)) || Number(valor) < 0)) {
                return NextResponse.json({ error: `${campo} debe ser un entero mayor o igual a cero` }, { status: 400 })
            }
        }

        const totalProducido = body.unidadesProducidas !== undefined
            ? Number(body.unidadesProducidas)
            : loteActual.unidadesProducidas
        const totalRechazado = body.unidadesRechazadas !== undefined
            ? Number(body.unidadesRechazadas)
            : loteActual.unidadesRechazadas

        let resultadoProduccion
        try {
            resultadoProduccion = calcularResultadoProduccion(totalProducido, totalRechazado)
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Resultado de producción inválido' },
                { status: 400 },
            )
        }

        const lote = await prisma.$transaction(async (tx) => {
            const updated = await tx.lote.update({
                where: { id },
                data: {
                    ...(body.estado !== undefined && { estado: body.estado }),
                    ...(body.horaFin !== undefined && { horaFin: body.horaFin ? new Date(body.horaFin) : null }),
                    ...(body.unidadesProducidas !== undefined && { unidadesProducidas: parseInt(body.unidadesProducidas) }),
                    ...(body.unidadesProducidas !== undefined && loteActual.estado === 'en_produccion' && nuevoEstado === 'en_produccion' && {
                        unidadesPlanificadas: parseInt(body.unidadesProducidas),
                    }),
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

            const distribucionInicial = Array.isArray(loteActual.distribucion)
                ? loteActual.distribucion as { presentacionId?: string }[]
                : []
            const presentacionBase = updated.producto.presentaciones.find(
                (presentacion) => presentacion.id === distribucionInicial[0]?.presentacionId,
            ) || [...updated.producto.presentaciones].sort((a, b) => b.cantidad - a.cantidad)[0]

            let distribucionFinal: { presentacionId: string; cantidad: number }[] | undefined
            let objetivosProductoTerminado: ObjetivoProductoLote[] = []

            // Solo los paquetes buenos ingresan a stock de producto terminado.
            if (nuevoEstado !== 'en_produccion') {
                if (!presentacionBase) {
                    throw new LoteValidationError('El producto no tiene una presentación base configurada')
                }

                const distribucionValidada: { presentacionId: string; cantidad: number }[] = Array.isArray(body.distribucionPresentaciones)
                    ? body.distribucionPresentaciones.map((item: { presentacionId: string; cantidad: number | string }) => ({
                        presentacionId: item.presentacionId,
                        cantidad: Number(item.cantidad),
                    }))
                    : [{ presentacionId: presentacionBase.id, cantidad: resultadoProduccion.paquetesBuenos }]
                distribucionFinal = distribucionValidada

                const presentacionesPorId = new Map(
                    updated.producto.presentaciones.map((presentacion) => [presentacion.id, presentacion]),
                )
                const presentacionesIncluidas = new Set<string>()
                let unidadesDistribuidas = 0

                for (const item of distribucionValidada) {
                    if (presentacionesIncluidas.has(item.presentacionId)) {
                        throw new LoteValidationError('La distribución no puede repetir una presentación')
                    }
                    presentacionesIncluidas.add(item.presentacionId)
                    const presentacion = presentacionesPorId.get(item.presentacionId)
                    if (!presentacion) {
                        throw new LoteValidationError('La distribución contiene una presentación que no pertenece al producto')
                    }
                    if (!Number.isInteger(item.cantidad) || item.cantidad < 0) {
                        throw new LoteValidationError('Las cantidades distribuidas deben ser enteros mayores o iguales a cero')
                    }
                    unidadesDistribuidas += item.cantidad * presentacion.cantidad
                }

                const unidadesBuenasEsperadas = resultadoProduccion.paquetesBuenos * presentacionBase.cantidad
                if (unidadesDistribuidas !== unidadesBuenasEsperadas) {
                    throw new LoteValidationError(
                        `La distribución debe representar ${resultadoProduccion.paquetesBuenos} paquetes buenos (${unidadesBuenasEsperadas} unidades), no ${unidadesDistribuidas}`,
                    )
                }

                // Mantener la presentación original en primer lugar permite
                // recalcular consumos correctamente si el lote se edita luego.
                if (!presentacionesIncluidas.has(presentacionBase.id)) {
                    distribucionValidada.unshift({ presentacionId: presentacionBase.id, cantidad: 0 })
                } else {
                    distribucionValidada.sort((a, b) =>
                        a.presentacionId === presentacionBase.id ? -1 : b.presentacionId === presentacionBase.id ? 1 : 0,
                    )
                }

                await tx.lote.update({
                    where: { id },
                    data: { distribucion: distribucionValidada },
                })

                objetivosProductoTerminado = distribucionValidada
                    .filter(item => item.cantidad > 0)
                    .map(item => ({
                        productoId: updated.productoId,
                        presentacionId: item.presentacionId,
                        ubicacionId: body.ubicacionId || updated.ubicacionId,
                        cantidad: item.cantidad,
                    }))
            }

            await conciliarProductoTerminadoLote(tx, id, objetivosProductoTerminado)

            // ─── Conciliación de insumos sin borrar el historial ───
            const fichas = await tx.fichaTecnica.findMany({
                where: { productoId: updated.productoId },
                select: { insumoId: true, cantidadPorUnidad: true, merma: true },
            })
            if (presentacionBase && fichas.length > 0) {
                const paquetesConsumidos = nuevoEstado === 'en_produccion'
                    ? updated.unidadesPlanificadas || updated.unidadesProducidas
                    : updated.unidadesProducidas
                const consumosObjetivo = calcularConsumosProduccion(
                    fichas,
                    paquetesConsumidos,
                    presentacionBase.cantidad,
                )
                await conciliarConsumoLote(tx, {
                    loteId: id,
                    ubicacionId: body.ubicacionId || updated.ubicacionId,
                    consumosObjetivo,
                })
            }

            return distribucionFinal ? { ...updated, distribucion: distribucionFinal } : updated
        }, { timeout: 30000 })

        return NextResponse.json(lote)
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack : ''
        console.error('Error updating lote:', msg)
        console.error('Stack:', stack)
        if (error instanceof LoteValidationError) {
            return NextResponse.json({ error: msg }, { status: 400 })
        }
        return NextResponse.json({ error: `Error al actualizar lote: ${msg}` }, { status: 500 })
    }
}

// DELETE /api/lotes/:id — Anular lote, revertir stock y conservar trazabilidad
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const lote = await prisma.lote.findUnique({
            where: { id },
            include: { movimientosProducto: true },
        })

        if (!lote) {
            return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
        }
        if (lote.estado === 'cancelado') {
            return NextResponse.json({ error: 'El lote ya fue anulado' }, { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
            // Llevar el consumo neto a cero crea las devoluciones necesarias sin
            // borrar los movimientos originales.
            await conciliarConsumoLote(tx, {
                loteId: id,
                ubicacionId: lote.ubicacionId,
                consumosObjetivo: [],
            })

            // Revertir solamente el saldo neto y conservar todos los movimientos.
            await conciliarProductoTerminadoLote(tx, id, [], 'anulacion')

            await tx.detallePedido.updateMany({
                where: { loteId: id },
                data: { loteId: null },
            })

            await tx.lote.update({
                where: { id },
                data: { estado: 'cancelado', horaFin: new Date() },
            })
        })

        return NextResponse.json({ ok: true, mensaje: `Lote ${id} anulado y stock revertido` })
    } catch (error) {
        console.error('Error cancelling lote:', error)
        return NextResponse.json({ error: 'Error al anular lote' }, { status: 500 })
    }
}
