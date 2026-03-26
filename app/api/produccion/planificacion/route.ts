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

        // 3. Obtener requerimientos manuales del día
        const manuales = await prisma.requerimientoProduccion.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            include: { 
                producto: true,
                presentacion: true
            }
        })

        // 4. Consolidar necesidades por [productoId_presentacionId] y turno
        const necesidades: Record<string, Record<string, number>> = {
            'Mañana': {},
            'Siesta': {},
            'Tarde': {},
            'Por Asignar': {}
        }

        const infoProductos: Record<string, any> = {}

        // Helper para registrar en infoProductos
        const registerInfo = (prod: any, pres: any) => {
            const key = pres ? `${prod.id}_${pres.id}` : `${prod.id}_null`
            if (!infoProductos[key]) {
                infoProductos[key] = {
                    ...prod,
                    presentacion: pres
                }
            }
            return key
        }

        // Procesar rutas
        rutas.forEach(ruta => {
            const turno = ruta.turno || 'Sin Turno'
            if (!necesidades[turno]) necesidades[turno] = {}
            
            ruta.entregas.forEach(entrega => {
                entrega.pedido.detalles.forEach(detalle => {
                    const prod = detalle.presentacion.producto
                    const pres = detalle.presentacion
                    const key = registerInfo(prod, pres)
                    const cantTotal = detalle.cantidad * pres.cantidad
                    
                    necesidades[turno][key] = (necesidades[turno][key] || 0) + cantTotal
                })
            })
        })

        // Procesar pedidos sin ruta
        pedidosSinRuta.forEach(pedido => {
            pedido.detalles.forEach(detalle => {
                const prod = detalle.presentacion.producto
                const pres = detalle.presentacion
                const key = registerInfo(prod, pres)
                const cantTotal = detalle.cantidad * pres.cantidad
                
                necesidades['Por Asignar'][key] = (necesidades['Por Asignar'][key] || 0) + cantTotal
            })
        })

        // Procesar requerimientos manuales
        manuales.forEach(m => {
            const turno = m.turno
            if (!necesidades[turno]) necesidades[turno] = {}
            
            let key = ""
            if (m.presentacionId && m.presentacion) {
                key = registerInfo(m.producto, m.presentacion)
            } else {
                // Fallback para registros viejos sin presentacionId: usar la más grande
                key = `${m.productoId}_null`
                if (!infoProductos[key]) infoProductos[key] = m.producto
            }
            
            necesidades[turno][key] = (necesidades[turno][key] || 0) + m.cantidad
        })

        // 5. Obtener stock actual consolidado por PRESENTACION (solo FABRICA)
        const stockActual = await prisma.stockProducto.groupBy({
            by: ['productoId', 'presentacionId'],
            where: { ubicacion: { tipo: 'FABRICA' } },
            _sum: { cantidad: true }
        })

        // 6. Obtener lo que ya está en producción hoy (Lotes solo tienen productoId)
        const enProduccion = await prisma.lote.findMany({
            where: {
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
                estado: 'en_produccion'
            },
            select: { productoId: true, unidadesProducidas: true }
        })

        const consolidadoProduccion: Record<string, number> = {}
        enProduccion.forEach(l => {
            // Como el Lote no tiene presentación, consolidamos por productoId
            // En el frontend sumaremos esto al "total sándwiches" del producto o lo prorratearemos
            consolidadoProduccion[l.productoId] = (consolidadoProduccion[l.productoId] || 0) + l.unidadesProducidas
            // Nota: Aquí l.unidadesProducidas son PAQUETES. Necesitamos normalizar a unidades.
            // Para simplificar, asumimos que un Lote en producción usa el estándar (48) o buscamos el producto
        })

        return NextResponse.json({
            necesidades,
            infoProductos,
            stockFabricacion: stockActual.reduce((acc, s) => {
                const key = s.presentacionId ? `${s.productoId}_${s.presentacionId}` : `${s.productoId}_null`
                acc[key] = s._sum.cantidad || 0
                return acc
            }, {} as Record<string, number>),
            enProduccion: consolidadoProduccion // Ojo: esto es por productoId, el dashboard tendrá que manejarlo
        })

    } catch (error) {
        console.error('Error en planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
