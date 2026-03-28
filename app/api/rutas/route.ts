import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/rutas
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const choferId = searchParams.get('choferId')
    const fechaStr = searchParams.get('fecha') // YYYY-MM-DD

    try {
        const whereClause: Record<string, unknown> = {}
        if (choferId) whereClause.choferId = choferId
        if (fechaStr) {
            const startOfDay = new Date(fechaStr)
            startOfDay.setUTCHours(0, 0, 0, 0)
            const endOfDay = new Date(fechaStr)
            endOfDay.setUTCHours(23, 59, 59, 999)
            whereClause.fecha = { gte: startOfDay, lte: endOfDay }
        }

        const rutas = await prisma.ruta.findMany({
            where: whereClause,
            orderBy: { fecha: 'desc' },
            include: {
                chofer: { select: { id: true, nombre: true } },
                entregas: {
                    include: {
                        pedido: {
                            include: {
                                detalles: {
                                    include: {
                                        presentacion: {
                                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } }
                                        }
                                    }
                                }
                            }
                        },
                        cliente: { select: { id: true, nombreComercial: true, direccion: true, zona: true } }
                    },
                    orderBy: { orden: 'asc' }
                }
            }
        })
        return NextResponse.json(rutas)
    } catch (error) {
        console.error('Error fetching rutas:', error)
        return NextResponse.json({ error: 'Error al obtener rutas' }, { status: 500 })
    }
}

// POST /api/rutas
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { choferId, fecha, zona, turno, pedidos, ubicacionOrigenId } = body // pedidos = array of { pedidoId, clienteId }

        if (!choferId || !fecha || !pedidos?.length) {
            return NextResponse.json({ error: 'Faltan campos obligatorios o pedidos' }, { status: 400 })
        }

        // Si no viene ubicacionOrigenId, buscamos la primera de tipo FABRICA
        let finalOrigenId = ubicacionOrigenId
        if (!finalOrigenId) {
            const fabrica = await prisma.ubicacion.findFirst({ where: { tipo: 'FABRICA' } })
            finalOrigenId = fabrica?.id
        }

        if (!finalOrigenId) {
            return NextResponse.json({ error: 'No se encontró una ubicación de origen (Fábrica) válida.' }, { status: 400 })
        }

        const ruta = await prisma.$transaction(async (tx) => {
            // 1. Crear ruta
            const nuevaRuta = await tx.ruta.create({
                data: {
                    choferId,
                    fecha: new Date(fecha),
                    zona: zona || null,
                    turno: turno || null,
                    ubicacionOrigenId: finalOrigenId,
                    entregas: {
                        create: pedidos.map((p: { pedidoId: string, clienteId: string }, index: number) => ({
                            pedidoId: p.pedidoId,
                            clienteId: p.clienteId,
                            orden: index
                        }))
                    }
                },
                include: { entregas: true }
            })

            // 2. Actualizar estado de los pedidos a en_ruta
            await tx.pedido.updateMany({
                where: { id: { in: pedidos.map((p: { pedidoId: string }) => p.pedidoId) } },
                data: { estado: 'en_ruta' }
            })

            // 3. Descontar Stock y crear Movimientos
            // Obtenemos todos los detalles de los pedidos para consolidar el descuento
            const detallesPedidos = await tx.detallePedido.findMany({
                where: { pedidoId: { in: pedidos.map((p: { pedidoId: string }) => p.pedidoId) } },
                include: { presentacion: true }
            })

            // Consolidar por presentacionId
            const consolidado: Record<string, { productoId: string, cantidad: number }> = {}
            detallesPedidos.forEach(det => {
                const key = det.presentacionId
                if (!consolidado[key]) {
                    consolidado[key] = { productoId: det.productoId, cantidad: 0 }
                }
                consolidado[key].cantidad += det.cantidad
            })

            for (const [presId, info] of Object.entries(consolidado)) {
                // Descontar de StockProducto
                await tx.stockProducto.upsert({
                    where: { 
                        productoId_presentacionId_ubicacionId: { 
                            productoId: info.productoId, 
                            presentacionId: presId, 
                            ubicacionId: finalOrigenId 
                        } 
                    },
                    update: { cantidad: { decrement: info.cantidad } },
                    create: { 
                        productoId: info.productoId, 
                        presentacionId: presId, 
                        ubicacionId: finalOrigenId, 
                        cantidad: -info.cantidad 
                    }
                })

                // Registro de Movimiento
                await tx.movimientoProducto.create({
                    data: {
                        tipo: 'salida_ruta',
                        cantidad: info.cantidad,
                        signo: 'salida',
                        productoId: info.productoId,
                        presentacionId: presId,
                        ubicacionId: finalOrigenId,
                        rutaId: nuevaRuta.id,
                        observaciones: `Salida por Ruta ${nuevaRuta.id} - Chofer ${choferId}`
                    }
                })
            }

            return nuevaRuta
        })

        return NextResponse.json(ruta, { status: 201 })
    } catch (error) {
        console.error('Error creating ruta:', error)
        return NextResponse.json({ error: 'Error al crear la ruta' }, { status: 500 })
    }
}

// DELETE /api/rutas?id=xxx — Eliminar ruta y revertir pedidos
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        await prisma.$transaction(async (tx) => {
            // Obtener entregas de la ruta para revertir pedidos
            const entregas = await tx.entrega.findMany({
                where: { rutaId: id },
                select: { pedidoId: true, horaEntrega: true }
            })

            // Revertir pedidos no entregados a 'confirmado'
            const pedidosNoEntregados = entregas
                .filter(e => !e.horaEntrega)
                .map(e => e.pedidoId)

            if (pedidosNoEntregados.length > 0) {
                await tx.pedido.updateMany({
                    where: { id: { in: pedidosNoEntregados } },
                    data: { estado: 'confirmado' }
                })
            }

            // Eliminar entregas y ruta
            await tx.entrega.deleteMany({ where: { rutaId: id } })
            await tx.ruta.delete({ where: { id } })
        })

        return NextResponse.json({ ok: true, mensaje: 'Ruta eliminada y pedidos revertidos' })
    } catch (error) {
        console.error('Error deleting ruta:', error)
        return NextResponse.json({ error: 'Error al eliminar ruta' }, { status: 500 })
    }
}
