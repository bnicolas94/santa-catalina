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

        // --- NUEVO: Objeto separado para demanda de logística (solo referencia) ---
        const demandaRutas: Record<string, Record<string, number>> = {
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

        // Procesar rutas -> AHORA VA A demandaRutas (NO a necesidades)
        rutas.forEach(ruta => {
            const turno = ruta.turno || 'Sin Turno'
            if (!demandaRutas[turno]) demandaRutas[turno] = {}
            
            ruta.entregas.forEach(entrega => {
                entrega.pedido.detalles.forEach(detalle => {
                    const prod = detalle.presentacion.producto
                    const pres = detalle.presentacion
                    const key = registerInfo(prod, pres)
                    const cantTotal = detalle.cantidad * pres.cantidad
                    
                    demandaRutas[turno][key] = (demandaRutas[turno][key] || 0) + cantTotal
                })
            })
        })

        // Procesar pedidos sin ruta -> AHORA SE IGNORAN para el total de producción
        pedidosSinRuta.forEach(pedido => {
            const turnoPedido = pedido.turno || 'Por Asignar'
            const turnoFinal = ['Mañana', 'Siesta', 'Tarde'].includes(turnoPedido) ? turnoPedido : 'Por Asignar'
            
            if (!demandaRutas[turnoFinal]) demandaRutas[turnoFinal] = {}

            pedido.detalles.forEach(detalle => {
                const prod = detalle.presentacion.producto
                const pres = detalle.presentacion
                const key = registerInfo(prod, pres)
                const cantTotal = detalle.cantidad * pres.cantidad
                
                // Lo sumamos a demandaRutas como referencia "proyectada"
                demandaRutas[turnoFinal][key] = (demandaRutas[turnoFinal][key] || 0) + cantTotal
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
                fechaProduccion: { gte: startOfDay, lte: endOfDay },
                estado: 'en_produccion'
            },
            include: { producto: { include: { presentaciones: { orderBy: { cantidad: 'desc' } } } } }
        })

        const enProduccion: Record<string, number> = {}
        enProduccionRaw.forEach(l => {
            if (l.distribucion && Array.isArray(l.distribucion)) {
                // Si el lote tiene distribución detallada, la usamos
                const dist = l.distribucion as any[]
                dist.forEach(d => {
                    const pres = l.producto.presentaciones.find(p => p.id === d.presentacionId)
                    const size = pres?.cantidad || 48
                    const key = `${l.productoId}_${d.presentacionId}`
                    enProduccion[key] = (enProduccion[key] || 0) + (Number(d.cantidad) * size)
                })
            } else {
                // Unidades por paquete: usamos la presentación más grande del producto como estándar
                // o 48 si no tiene presentaciones definidas
                const size = l.producto.presentaciones[0]?.cantidad || 48
                const key = `${l.productoId}_${l.producto.presentaciones[0]?.id || 'null'}`
                enProduccion[key] = (enProduccion[key] || 0) + (l.unidadesProducidas * size)
            }
        })

        const shipmentCounts: Record<string, number> = {
            'Mañana': 0,
            'Siesta': 0,
            'Tarde': 0,
            'Por Asignar': 0,
            'Totales': 0
        }
        const shipmentsSet: Record<string, Set<string>> = {}

        // --- AHORA shipmentCounts SOLO cuenta lo del Excel/Manual para no duplicar ---
        manuales.forEach(m => {
            if (m.destino === 'LOCAL') return // No es un envío de reparto
            const turno = m.turno
            if (!shipmentsSet[turno]) shipmentsSet[turno] = new Set()
            
            if (m.shipmentId) {
                shipmentsSet[turno].add(m.shipmentId)
            } else {
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
            necesidades, // Pura demanda manual (Excel)
            demandaRutas, // Nueva referencia de Logística
            infoProductos,
            shipmentCounts,
            descuentosRealizados: descuentosTurnos.map((d: any) => d.turno),
            pendientesAnteriores,
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
