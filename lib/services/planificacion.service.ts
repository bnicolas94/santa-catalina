import { prisma } from '@/lib/prisma'

export class PlanificacionService {
    static async getPlanificacionDiaria(fechaStr: string) {
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
            // Intentamos usar el turno del pedido, si no, va a "Por Asignar"
            const turnoPedido = pedido.turno || 'Por Asignar'
            // Validamos que el turno sea uno de los conocidos para evitar errores de claves
            const turnoFinal = ['Mañana', 'Siesta', 'Tarde'].includes(turnoPedido) ? turnoPedido : 'Por Asignar'
            
            if (!necesidades[turnoFinal]) necesidades[turnoFinal] = {}

            pedido.detalles.forEach(detalle => {
                const prod = detalle.presentacion.producto
                const pres = detalle.presentacion
                const key = registerInfo(prod, pres)
                const cantTotal = detalle.cantidad * pres.cantidad
                
                necesidades[turnoFinal][key] = (necesidades[turnoFinal][key] || 0) + cantTotal
            })
        })

        manuales.forEach(m => {
            if (!m.productoId) return // Ignorar "marcadores" de envíos sin productos
            const turno = m.turno
            if (!necesidades[turno]) necesidades[turno] = {}
            
            let key = ""
            if (m.presentacionId && m.presentacion) {
                key = registerInfo(m.producto, m.presentacion)
            } else {
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
                fechaProduccion: { lte: endOfDay },
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

        const shipmentCounts: Record<string, number> = {
            'Mañana': 0,
            'Siesta': 0,
            'Tarde': 0,
            'Por Asignar': 0,
            'Totales': 0
        }
        const shipmentsSet: Record<string, Set<string>> = {}

        // 1. Contar envíos de Rutas
        rutas.forEach(ruta => {
            const turno = ruta.turno || 'Sin Turno'
            if (shipmentCounts[turno] === undefined) shipmentCounts[turno] = 0
            shipmentCounts[turno] += ruta.entregas.length
        })

        // 2. Contar envíos de Pedidos Sin Ruta (NUEVO: para que aparezcan en los badges del dashboard)
        pedidosSinRuta.forEach(pedido => {
            const turnoPedido = pedido.turno || 'Por Asignar'
            const turnoFinal = ['Mañana', 'Siesta', 'Tarde'].includes(turnoPedido) ? turnoPedido : 'Por Asignar'
            if (shipmentCounts[turnoFinal] === undefined) shipmentCounts[turnoFinal] = 0
            shipmentCounts[turnoFinal] += 1
        })

        // 3. Contar envíos de Requerimientos Manuales/Importados (usando shipmentId único)
        manuales.forEach(m => {
            if (m.destino === 'LOCAL') return // No es un envío de reparto
            const turno = m.turno
            if (!shipmentsSet[turno]) shipmentsSet[turno] = new Set()
            
            // Si tiene shipmentId lo usamos para agrupar, si no (legacy) lo contamos como 1 individual
            if (m.shipmentId) {
                shipmentsSet[turno].add(m.shipmentId)
            } else {
                // Para datos viejos sin shipmentId, usamos el ID del registro para no subestimar
                shipmentsSet[turno].add(m.id)
            }
        })

        // Sumar conteos de manuales al total
        Object.entries(shipmentsSet).forEach(([turno, set]) => {
            if (shipmentCounts[turno] === undefined) shipmentCounts[turno] = 0
            shipmentCounts[turno] += set.size
        })

        // Calcular total global
        shipmentCounts['Totales'] = Object.entries(shipmentCounts)
            .filter(([k]) => k !== 'Totales')
            .reduce((acc, [_, v]) => acc + v, 0)
        
        // @ts-ignore
        const descuentosTurnos = await prisma.planificacionDescuento.findMany({
            where: { fecha: { gte: startOfDay, lte: endOfDay } },
            select: { turno: true }
        })

        // --- NUEVO: CÁLCULO DE PENDIENTES ANTERIORES (Cumulative Stock Projection) ---
        // Buscamos requerimientos de los últimos 60 días que NO hayan sido descontados
        const sesentaDiasAtras = new Date(startOfDay.getTime() - (60 * 24 * 60 * 60 * 1000))
        
        // 1. Obtener todos los descuentos de los últimos 60 días
        // @ts-ignore
        const todosDescuentosRecientes = await prisma.planificacionDescuento.findMany({
            where: { fecha: { gte: sesentaDiasAtras, lt: startOfDay } },
            select: { fecha: true, turno: true }
        })
        const descuentosSet = new Set(todosDescuentosRecientes.map((d: any) => `${d.fecha.toISOString().split('T')[0]}_${d.turno}`))

        // 2. Obtener requerimientos manuales pendientes
        const manualesPendientes = await prisma.requerimientoProduccion.findMany({
            where: { 
                fecha: { gte: sesentaDiasAtras, lt: startOfDay },
                productoId: { not: null }
            },
            include: { producto: true, presentacion: true }
        })

        // 3. Obtener rutas pendientes (necesitamos los detalles de pedidos)
        const rutasPendientes = await prisma.ruta.findMany({
            where: { fecha: { gte: sesentaDiasAtras, lt: startOfDay } },
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

        const pendientesAnteriores: Record<string, { total: number, detalles: { fecha: string, turno: string, cantidad: number }[] }> = {}

        const registerPendiente = (keyProd: string, fecha: Date, turno: string, cantidad: number) => {
            if (!pendientesAnteriores[keyProd]) {
                pendientesAnteriores[keyProd] = { total: 0, detalles: [] }
            }
            pendientesAnteriores[keyProd].total += cantidad
            
            // Buscar si ya existe la misma fecha/turno para agrupar
            const fechaStr = fecha.toISOString().split('T')[0]
            const existing = pendientesAnteriores[keyProd].detalles.find(d => d.fecha === fechaStr && d.turno === turno)
            if (existing) {
                existing.cantidad += cantidad
            } else {
                pendientesAnteriores[keyProd].detalles.push({ fecha: fechaStr, turno, cantidad })
            }
        }

        // Procesar manuales pendientes
        manualesPendientes.forEach(m => {
            const keyDesc = `${m.fecha.toISOString().split('T')[0]}_${m.turno}`
            if (descuentosSet.has(keyDesc)) return // Ya descontado

            // @ts-ignore
            const keyProd = m.presentacionId ? `${m.productoId}_${m.presentacionId}` : `${m.productoId}_null`
            registerPendiente(keyProd, m.fecha, m.turno, m.cantidad)
            
            // Asegurar que infoProductos tenga la info si no estaba hoy
            if (m.producto) registerInfo(m.producto, m.presentacion)
        })

        // Procesar rutas pendientes
        rutasPendientes.forEach(ruta => {
            const keyDesc = `${ruta.fecha.toISOString().split('T')[0]}_${ruta.turno}`
            if (descuentosSet.has(keyDesc)) return // Ya descontado

            ruta.entregas.forEach(entrega => {
                entrega.pedido.detalles.forEach(detalle => {
                    const prod = detalle.presentacion.producto
                    const pres = detalle.presentacion
                    const keyProd = registerInfo(prod, pres)
                    const cantTotal = detalle.cantidad * pres.cantidad
                    registerPendiente(keyProd, ruta.fecha, ruta.turno || 'Sin Turno', cantTotal)
                })
            })
        })

        return {
            necesidades,
            infoProductos,
            shipmentCounts,
            descuentosRealizados: descuentosTurnos.map((d: any) => d.turno),
            pendientesAnteriores, // <-- Enviamos los pendientes acumulados de días pasados
            manualesDetalle: manuales.reduce((acc, m) => {
                const turno = m.turno
                // @ts-ignore
                const key = m.presentacionId ? `${m.productoId}_${m.presentacionId}` : `${m.productoId}_null`
                if (!acc[turno]) acc[turno] = {}
                if (!acc[turno][key]) acc[turno][key] = { fabrica: 0, local: 0 }
                if (m.destino === 'LOCAL') acc[turno][key].local += m.cantidad
                else acc[turno][key].fabrica += m.cantidad
                return acc
            }, {} as Record<string, Record<string, { fabrica: number, local: number }>>),
            stockFabricacion,
            stockLocal,
            enProduccion
        }
    }
}
