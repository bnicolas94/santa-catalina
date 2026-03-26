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

        // 5. Obtener stock actual consolidado por PRESENTACION (FABRICA y LOCAL)
        const stockActualRaw = await prisma.stockProducto.findMany({
            include: { 
                presentacion: true,
                ubicacion: true
            }
        })

        const stockFabricacion: Record<string, number> = {}
        const stockLocal: Record<string, number> = {}
        
        stockActualRaw.forEach(s => {
            const key = s.presentacionId ? `${s.productoId}_${s.presentacionId}` : `${s.productoId}_null`
            const units = s.cantidad * (s.presentacion?.cantidad || 48)
            
            if (s.ubicacion.tipo === 'FABRICA') {
                stockFabricacion[key] = (stockFabricacion[key] || 0) + units
            } else if (s.ubicacion.tipo === 'LOCAL') {
                stockLocal[key] = (stockLocal[key] || 0) + units
            }
        })

        // 6. Obtener lo que ya está en producción hoy
        const enProduccionRaw = await prisma.lote.findMany({
            where: {
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
                estado: 'en_produccion'
            },
            include: { producto: { include: { presentaciones: { orderBy: { cantidad: 'desc' } } } } }
        })

        const enProduccion: Record<string, number> = {}
        enProduccionRaw.forEach(l => {
            // Unidades por paquete: usamos la presentación más grande del producto como estándar
            // o 48 si no tiene presentaciones definidas
            const size = l.producto.presentaciones[0]?.cantidad || 48
            enProduccion[l.productoId] = (enProduccion[l.productoId] || 0) + (l.unidadesProducidas * size)
        })

        return NextResponse.json({
            necesidades,
            infoProductos,
            manuales: manuales.reduce((acc, m) => {
                const turno = m.turno
                const key = m.presentacionId ? `${m.productoId}_${m.presentacionId}` : `${m.productoId}_null`
                if (!acc[turno]) acc[turno] = {}
                acc[turno][key] = (acc[turno][key] || 0) + m.cantidad
                return acc
            }, {} as Record<string, Record<string, number>>),
            stockFabricacion,
            stockLocal,
            enProduccion
        })

    } catch (error) {
        console.error('Error en planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
