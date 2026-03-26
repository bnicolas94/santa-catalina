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

        const startOfDay = new Date(`${fechaStr}T00:00:00.000Z`)
        const endOfDay = new Date(`${fechaStr}T23:59:59.999Z`)

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

        // 4. Obtener todos los productos con sus presentaciones para determinar la primaria
        const allProducts = await prisma.producto.findMany({
            include: { presentaciones: { orderBy: { cantidad: 'desc' } } }
        })
        const primaryPresIds: Record<string, string> = {}
        allProducts.forEach(p => {
            if (p.presentaciones[0]) primaryPresIds[p.id] = p.presentaciones[0].id
        })

        // 5. Consolidar necesidades por [productoId_presentacionId] y turno
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
                    presentacion: pres,
                    isPrimary: pres ? (primaryPresIds[prod.id] === pres.id) : true
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
            // @ts-ignore - Prisma types might be stale
            if (m.presentacionId && m.presentacion) {
                // @ts-ignore
                key = registerInfo(m.producto, m.presentacion)
            } else {
                // @ts-ignore
                key = `${m.productoId}_null`
                // @ts-ignore
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
            manualesDetalle: manuales.reduce((acc, m) => {
                const turno = m.turno
                // @ts-ignore
                const key = m.presentacionId ? `${m.productoId}_${m.presentacionId}` : `${m.productoId}_null`
                if (!acc[turno]) acc[turno] = {}
                if (!acc[turno][key]) acc[turno][key] = { fabrica: 0, local: 0 }
                // @ts-ignore
                if (m.destino === 'LOCAL') acc[turno][key].local += m.cantidad
                else acc[turno][key].fabrica += m.cantidad
                return acc
            }, {} as Record<string, Record<string, { fabrica: number, local: number }>>),
            stockFabricacion,
            stockLocal,
            enProduccion
        })

    } catch (error) {
        console.error('Error en planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para borrar planificación' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha')

        if (!fechaStr) {
            return NextResponse.json({ error: 'Fecha es requerida' }, { status: 400 })
        }

        const startOfDay = new Date(`${fechaStr}T00:00:00.000Z`)
        const endOfDay = new Date(`${fechaStr}T23:59:59.999Z`)

        await prisma.requerimientoProduccion.deleteMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } }
        })

        return NextResponse.json({ success: true, message: 'Planificación eliminada' })

    } catch (error) {
        console.error('Error al borrar planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
