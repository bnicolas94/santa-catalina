import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { aplicarDeltaStockInsumo, STOCK_TOLERANCE } from '@/lib/services/produccion-insumos'
import { cantidadSecundariaParaConteo, coincideStockConteo, parseCantidadConteo } from '@/lib/insumos/conteos'

interface DetalleConteoInput {
    insumoId: string
    cantidadContada: number | string
    stockSistemaEsperado?: number
}

class StockConteoModificadoError extends Error {}

function leerEntradaConteo(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Datos del conteo inválidos')
    const input = body as Record<string, unknown>
    const ubicacionId = typeof input.ubicacionId === 'string' ? input.ubicacionId.trim() : ''
    const detalles = Array.isArray(input.detalles) ? input.detalles as DetalleConteoInput[] : []
    if (!ubicacionId || detalles.length === 0) throw new Error('Seleccioná una sede y cargá al menos un insumo')
    const ids = detalles.map((item) => item?.insumoId)
    if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
        throw new Error('El conteo tiene insumos inválidos o repetidos')
    }
    const cantidades = detalles.map((item) => parseCantidadConteo(item.cantidadContada))
    if (cantidades.some((cantidad) => !Number.isFinite(cantidad) || cantidad < 0)) {
        throw new Error('Todas las cantidades deben ser números mayores o iguales a cero')
    }
    return { ubicacionId, detalles, ids, cantidades, observaciones: input.observaciones ? String(input.observaciones).trim() : null }
}

export async function GET() {
    try {
        const conteos = await prisma.conteoInsumo.findMany({
            orderBy: { fecha: 'desc' },
            take: 30,
            include: {
                ubicacion: { select: { id: true, nombre: true } },
                responsable: { select: { id: true, nombre: true, apellido: true } },
                detalles: {
                    include: { insumo: { select: { id: true, nombre: true, unidadMedida: true } } },
                    orderBy: { insumo: { nombre: 'asc' } },
                },
            },
        })
        return NextResponse.json(conteos)
    } catch (error) {
        console.error('Error fetching conteos de insumos:', error)
        return NextResponse.json({ error: 'Error al obtener los conteos' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as { rol?: string; permisos?: { permisoStock?: boolean } } | undefined
        if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
        if (user.rol !== 'ADMIN' && !user.permisos?.permisoStock) {
            return NextResponse.json({ error: 'No tienes permiso para revisar conteos' }, { status: 403 })
        }

        const { ubicacionId, detalles, ids, cantidades } = leerEntradaConteo(await request.json())
        const [ubicacion, insumos] = await Promise.all([
            prisma.ubicacion.findFirst({ where: { id: ubicacionId, activo: true }, select: { id: true, nombre: true } }),
            prisma.insumo.findMany({
                where: { id: { in: ids }, activo: true },
                select: {
                    id: true, nombre: true, unidadMedida: true,
                    stocks: { where: { ubicacionId }, select: { cantidad: true, cantidadSecundaria: true } },
                },
            }),
        ])
        if (!ubicacion) throw new Error('Seleccioná una sede activa para el conteo')
        if (insumos.length !== ids.length) throw new Error('Uno o más insumos no existen o están inactivos')

        return NextResponse.json({
            ubicacion,
            revisadoEn: new Date().toISOString(),
            detalles: detalles.map((item, index) => {
                const insumo = insumos.find((actual) => actual.id === item.insumoId)!
                const stockSistema = insumo.stocks[0]?.cantidad || 0
                return {
                    insumoId: insumo.id,
                    nombre: insumo.nombre,
                    unidadMedida: insumo.unidadMedida,
                    stockSistema,
                    stockSecundario: insumo.stocks[0]?.cantidadSecundaria || 0,
                    cantidadContada: cantidades[index],
                    diferencia: Math.round((cantidades[index] - stockSistema) * 1_000_000) / 1_000_000,
                }
            }),
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo revisar el conteo'
        return NextResponse.json({ error: message }, { status: 400 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as { id?: string; rol?: string; permisos?: { permisoStock?: boolean } } | undefined
        if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
        if (user.rol !== 'ADMIN' && !user.permisos?.permisoStock) {
            return NextResponse.json({ error: 'No tienes permiso para registrar conteos' }, { status: 403 })
        }

        const { ubicacionId, detalles, ids, cantidades, observaciones } = leerEntradaConteo(await request.json())
        if (detalles.some((item) => typeof item.stockSistemaEsperado !== 'number' || !Number.isFinite(item.stockSistemaEsperado))) {
            return NextResponse.json({ error: 'Revisá el stock actualizado antes de confirmar el conteo' }, { status: 400 })
        }

        const conteo = await prisma.$transaction(async (tx) => {
            const [ubicacion, insumos] = await Promise.all([
                tx.ubicacion.findFirst({ where: { id: ubicacionId, activo: true }, select: { id: true, nombre: true } }),
                tx.insumo.findMany({
                    where: { id: { in: ids }, activo: true },
                    select: {
                        id: true,
                        nombre: true,
                        unidadMedida: true,
                        factorConversion: true,
                        stocks: { where: { ubicacionId }, select: { cantidad: true, cantidadSecundaria: true } },
                    },
                }),
            ])
            if (!ubicacion) throw new Error('Seleccioná una sede activa para el conteo')
            if (insumos.length !== ids.length) throw new Error('Uno o más insumos no existen o están inactivos')
            for (const item of detalles) {
                const stockActual = insumos.find((insumo) => insumo.id === item.insumoId)!.stocks[0]?.cantidad || 0
                if (!coincideStockConteo(stockActual, item.stockSistemaEsperado!)) {
                    throw new StockConteoModificadoError('El stock cambió después de la vista previa. Revisá el conteo nuevamente.')
                }
            }

            const nuevoConteo = await tx.conteoInsumo.create({
                data: {
                    ubicacionId,
                    responsableId: user.id || null,
                    observaciones,
                },
            })

            for (let index = 0; index < detalles.length; index++) {
                const item = detalles[index]
                const insumo = insumos.find((actual) => actual.id === item.insumoId)!
                const stockSistema = insumo.stocks[0]?.cantidad || 0
                const cantidadContada = cantidades[index]
                const diferencia = Math.round((cantidadContada - stockSistema) * 1_000_000) / 1_000_000
                const detalle = await tx.conteoInsumoDetalle.create({
                    data: {
                        conteoId: nuevoConteo.id,
                        insumoId: item.insumoId,
                        stockSistema,
                        cantidadContada,
                        diferencia,
                    },
                })

                if (Math.abs(diferencia) > STOCK_TOLERANCE) {
                    const movimiento = await aplicarDeltaStockInsumo(tx, {
                        insumoId: item.insumoId,
                        ubicacionId,
                        deltaStock: diferencia,
                        observaciones: `Ajuste por conteo ${nuevoConteo.id} — ${ubicacion.nombre}`,
                    })
                    if (movimiento) {
                        await tx.conteoInsumoDetalle.update({
                            where: { id: detalle.id },
                            data: { movimientoStockId: movimiento.id },
                        })
                    }
                }

                // La cantidad principal ingresada en el conteo es la fuente de verdad.
                // Reconciliar el valor secundario evita que saldos antiguos e invisibles
                // bloqueen una baja aun cuando el conteo físico principal quedó en cero.
                const cantidadSecundariaContada = cantidadSecundariaParaConteo(
                    cantidadContada,
                    insumo.factorConversion,
                    insumo.stocks[0]?.cantidadSecundaria || 0,
                )
                await tx.stockInsumo.upsert({
                    where: {
                        insumoId_ubicacionId: {
                            insumoId: item.insumoId,
                            ubicacionId,
                        },
                    },
                    create: {
                        insumoId: item.insumoId,
                        ubicacionId,
                        cantidad: cantidadContada,
                        cantidadSecundaria: cantidadSecundariaContada,
                    },
                    update: {
                        cantidad: cantidadContada,
                        cantidadSecundaria: cantidadSecundariaContada,
                    },
                })

                // El conteo es también un punto de conciliación: el total global pasa
                // a ser exactamente la suma de las ubicaciones conocidas.
                const totalUbicaciones = await tx.stockInsumo.aggregate({
                    where: { insumoId: item.insumoId },
                    _sum: { cantidad: true, cantidadSecundaria: true },
                })
                await tx.insumo.update({
                    where: { id: item.insumoId },
                    data: {
                        stockActual: totalUbicaciones._sum.cantidad || 0,
                        stockActualSecundario: totalUbicaciones._sum.cantidadSecundaria || 0,
                    },
                })
            }

            return tx.conteoInsumo.findUniqueOrThrow({
                where: { id: nuevoConteo.id },
                include: {
                    ubicacion: { select: { id: true, nombre: true } },
                    responsable: { select: { id: true, nombre: true, apellido: true } },
                    detalles: { include: { insumo: { select: { id: true, nombre: true, unidadMedida: true } } } },
                },
            })
        }, { timeout: 30000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

        return NextResponse.json(conteo, { status: 201 })
    } catch (error) {
        if (error instanceof StockConteoModificadoError ||
            (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
            return NextResponse.json({ error: 'El stock cambió durante el conteo. Revisá las diferencias nuevamente.' }, { status: 409 })
        }
        const message = error instanceof Error ? error.message : 'Error al registrar el conteo'
        console.error('Error creating conteo de insumos:', error)
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
