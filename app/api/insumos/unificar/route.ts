import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { prepararTransferenciaStock, UnificacionInsumoError } from '@/lib/insumos/unificacion'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as { rol?: string } | undefined
        if (!user || user.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Sólo un administrador puede unificar insumos' }, { status: 403 })
        }

        const body = await request.json() as Record<string, unknown>
        const origenId = String(body.origenId || '')
        const destinoId = String(body.destinoId || '')
        const factorPrimario = Number(String(body.factorPrimario || '').replace(',', '.'))
        const factorSecundario = Number(String(body.factorSecundario ?? '0').replace(',', '.'))
        if (!origenId || !destinoId || origenId === destinoId) {
            throw new UnificacionInsumoError('Seleccione dos insumos diferentes')
        }

        const resultado = await prisma.$transaction(async tx => {
            for (const lockId of [origenId, destinoId].sort()) {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'insumo:' + lockId}))::text AS lock_result`
            }
            const [origen, destino] = await Promise.all([
                tx.insumo.findUnique({
                    where: { id: origenId },
                    include: {
                        stocks: true,
                        proveedores: true,
                        _count: { select: { fichasTecnicas: true } },
                    },
                }),
                tx.insumo.findUnique({ where: { id: destinoId } }),
            ])
            if (!origen || !destino) throw new UnificacionInsumoError('Uno de los insumos no existe')
            if (!origen.activo || !destino.activo) throw new UnificacionInsumoError('Ambos insumos deben estar activos')
            if (origen._count.fichasTecnicas > 0) {
                throw new UnificacionInsumoError('El duplicado tiene fichas técnicas asociadas; deben revisarse antes de unificar')
            }

            const transferencias = prepararTransferenciaStock(
                origen.stockActual,
                origen.stockActualSecundario,
                origen.stocks.map(stock => ({
                    ubicacionId: stock.ubicacionId,
                    cantidad: stock.cantidad,
                    cantidadSecundaria: stock.cantidadSecundaria,
                })),
                factorPrimario,
                factorSecundario
            )
            const observaciones = `Unificación de insumo duplicado: ${origen.nombre} → ${destino.nombre}`

            for (const transferencia of transferencias) {
                if (transferencia.cantidad !== 0 || transferencia.cantidadSecundaria !== 0) {
                    await tx.movimientoStock.create({
                        data: {
                            insumoId: origen.id,
                            ubicacionId: transferencia.ubicacionId,
                            tipo: 'salida',
                            cantidad: transferencia.cantidad,
                            cantidadSecundaria: transferencia.cantidadSecundaria,
                            observaciones,
                        },
                    })
                    await tx.insumo.update({
                        where: { id: origen.id },
                        data: {
                            stockActual: { decrement: transferencia.cantidad },
                            stockActualSecundario: { decrement: transferencia.cantidadSecundaria },
                        },
                    })
                    await tx.stockInsumo.update({
                        where: { insumoId_ubicacionId: { insumoId: origen.id, ubicacionId: transferencia.ubicacionId } },
                        data: {
                            cantidad: { decrement: transferencia.cantidad },
                            cantidadSecundaria: { decrement: transferencia.cantidadSecundaria },
                        },
                    })
                }

                if (transferencia.cantidadDestino !== 0 || transferencia.cantidadSecundariaDestino !== 0) {
                    await tx.movimientoStock.create({
                        data: {
                            insumoId: destino.id,
                            ubicacionId: transferencia.ubicacionId,
                            tipo: 'entrada',
                            cantidad: transferencia.cantidadDestino,
                            cantidadSecundaria: transferencia.cantidadSecundariaDestino,
                            observaciones,
                        },
                    })
                    await tx.insumo.update({
                        where: { id: destino.id },
                        data: {
                            stockActual: { increment: transferencia.cantidadDestino },
                            stockActualSecundario: { increment: transferencia.cantidadSecundariaDestino },
                        },
                    })
                    await tx.stockInsumo.upsert({
                        where: { insumoId_ubicacionId: { insumoId: destino.id, ubicacionId: transferencia.ubicacionId } },
                        update: {
                            cantidad: { increment: transferencia.cantidadDestino },
                            cantidadSecundaria: { increment: transferencia.cantidadSecundariaDestino },
                        },
                        create: {
                            insumoId: destino.id,
                            ubicacionId: transferencia.ubicacionId,
                            cantidad: transferencia.cantidadDestino,
                            cantidadSecundaria: transferencia.cantidadSecundariaDestino,
                        },
                    })
                }
            }

            const proveedorIds = new Set(origen.proveedores.map(item => item.proveedorId))
            if (origen.proveedorId) proveedorIds.add(origen.proveedorId)
            for (const proveedorId of proveedorIds) {
                await tx.insumoProveedor.upsert({
                    where: { insumoId_proveedorId: { insumoId: destino.id, proveedorId } },
                    update: {},
                    create: { insumoId: destino.id, proveedorId },
                })
            }
            await tx.insumo.update({
                where: { id: origen.id },
                data: { activo: false },
            })

            return {
                origen: origen.nombre,
                destino: destino.nombre,
                cantidadOrigen: origen.stockActual,
                cantidadDestino: transferencias.reduce((total, item) => total + item.cantidadDestino, 0),
                unidadDestino: destino.unidadMedida,
            }
        }, { timeout: 30000 })

        return NextResponse.json(resultado)
    } catch (error) {
        if (error instanceof UnificacionInsumoError) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Error unificando insumos:', error)
        return NextResponse.json({ error: 'No se pudieron unificar los insumos' }, { status: 500 })
    }
}
