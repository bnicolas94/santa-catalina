import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { aplicarDeltaStockInsumo, STOCK_TOLERANCE } from '@/lib/services/produccion-insumos'

interface DetalleConteoInput {
    insumoId: string
    cantidadContada: number | string
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

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as { id?: string; rol?: string; permisos?: { permisoStock?: boolean } } | undefined
        if (!user || (user.rol !== 'ADMIN' && !user.permisos?.permisoStock)) {
            return NextResponse.json({ error: 'No tienes permiso para registrar conteos' }, { status: 403 })
        }

        const body = await request.json()
        const ubicacionId = String(body.ubicacionId || '')
        const observaciones = body.observaciones ? String(body.observaciones).trim() : null
        const detalles = Array.isArray(body.detalles) ? body.detalles as DetalleConteoInput[] : []
        if (!ubicacionId || detalles.length === 0) {
            return NextResponse.json({ error: 'Ubicación y al menos un insumo contado son requeridos' }, { status: 400 })
        }

        const ids = detalles.map((item) => item.insumoId)
        if (new Set(ids).size !== ids.length) {
            return NextResponse.json({ error: 'Hay insumos repetidos en el conteo' }, { status: 400 })
        }
        const cantidades = detalles.map((item) => Number(String(item.cantidadContada).replace(',', '.')))
        if (cantidades.some((cantidad) => !Number.isFinite(cantidad) || cantidad < 0)) {
            return NextResponse.json({ error: 'Todas las cantidades deben ser números mayores o iguales a cero' }, { status: 400 })
        }

        const conteo = await prisma.$transaction(async (tx) => {
            const [ubicacion, insumos] = await Promise.all([
                tx.ubicacion.findUnique({ where: { id: ubicacionId }, select: { id: true, nombre: true } }),
                tx.insumo.findMany({
                    where: { id: { in: ids }, activo: true },
                    select: {
                        id: true,
                        nombre: true,
                        unidadMedida: true,
                        stocks: { where: { ubicacionId }, select: { cantidad: true } },
                    },
                }),
            ])
            if (!ubicacion) throw new Error('Ubicación no encontrada')
            if (insumos.length !== ids.length) throw new Error('Uno o más insumos no existen o están inactivos')

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
        }, { timeout: 30000 })

        return NextResponse.json(conteo, { status: 201 })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al registrar el conteo'
        console.error('Error creating conteo de insumos:', error)
        return NextResponse.json({ error: message }, { status: 400 })
    }
}
