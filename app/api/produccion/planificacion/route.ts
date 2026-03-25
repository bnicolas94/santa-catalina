import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para ver planificación' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha') // YYYY-MM-DD

        if (!fechaStr) {
            return NextResponse.json({ error: 'Fecha es requerida' }, { status: 400 })
        }

        const startOfDay = new Date(fechaStr)
        startOfDay.setUTCHours(0, 0, 0, 0)
        const endOfDay = new Date(fechaStr)
        endOfDay.setUTCHours(23, 59, 59, 999)

        // 1. Obtener todas las rutas del día con sus pedidos y detalles
        const rutas = await prisma.ruta.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            include: {
                entregas: {
                    include: {
                        pedido: {
                            include: {
                                detalles: {
                                    include: {
                                        presentacion: {
                                            include: { producto: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })

        // 2. Obtener pedidos del día que NO están en ninguna ruta
        const pedidosSinRuta = await prisma.pedido.findMany({
            where: {
                fechaEntrega: { gte: startOfDay, lte: endOfDay },
                entregas: { none: {} }
            },
            include: {
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: true }
                        }
                    }
                }
            }
        })

        // 3. Consolidar necesidades por producto y turno
        const necesidades: Record<string, Record<string, number>> = {
            'Mañana': {},
            'Siesta': {},
            'Tarde': {},
            'Por Asignar': {}
        }

        const infoProductos: Record<string, any> = {}

        // Procesar rutas
        rutas.forEach(ruta => {
            const turno = ruta.turno || 'Sin Turno'
            if (!necesidades[turno]) necesidades[turno] = {}
            
            ruta.entregas.forEach(entrega => {
                entrega.pedido.detalles.forEach(detalle => {
                    const prod = detalle.presentacion.producto
                    const cantTotal = detalle.cantidad * detalle.presentacion.cantidad
                    const pid = prod.id
                    
                    necesidades[turno][pid] = (necesidades[turno][pid] || 0) + cantTotal
                    infoProductos[pid] = prod
                })
            })
        })

        // Procesar pedidos sin ruta
        pedidosSinRuta.forEach(pedido => {
            pedido.detalles.forEach(detalle => {
                const prod = detalle.presentacion.producto
                const cantTotal = detalle.cantidad * detalle.presentacion.cantidad
                const pid = prod.id
                
                necesidades['Por Asignar'][pid] = (necesidades['Por Asignar'][pid] || 0) + cantTotal
                infoProductos[pid] = prod
            })
        })

        // 4. Obtener stock actual consolidado (solo FABRICA)
        const stockActual = await prisma.stockProducto.groupBy({
            by: ['productoId'],
            where: { ubicacion: { tipo: 'FABRICA' } },
            _sum: { cantidad: true }
        })

        // 5. Obtener lo que ya está en producción hoy
        const enProduccion = await prisma.lote.findMany({
            where: {
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
                estado: 'en_produccion'
            },
            select: { productoId: true, unidadesProducidas: true }
        })

        const consolidadoProduccion: Record<string, number> = {}
        enProduccion.forEach(l => {
            consolidadoProduccion[l.productoId] = (consolidadoProduccion[l.productoId] || 0) + l.unidadesProducidas
        })

        return NextResponse.json({
            necesidades,
            infoProductos,
            stockFabricacion: stockActual.reduce((acc, s) => {
                acc[s.productoId] = s._sum.cantidad || 0
                return acc
            }, {} as Record<string, number>),
            enProduccion: consolidadoProduccion
        })

    } catch (error) {
        console.error('Error en planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
