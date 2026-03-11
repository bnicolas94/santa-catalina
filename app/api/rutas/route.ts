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
        const { choferId, fecha, zona, turno, pedidos } = body // pedidos = array of { pedidoId, clienteId }

        if (!choferId || !fecha || !pedidos?.length) {
            return NextResponse.json({ error: 'Faltan campos obligatorios o pedidos' }, { status: 400 })
        }

        const ruta = await prisma.$transaction(async (tx) => {
            // 1. Crear ruta
            const nuevaRuta = await tx.ruta.create({
                data: {
                    choferId,
                    fecha: new Date(fecha),
                    zona: zona || null,
                    turno: turno || null,
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
