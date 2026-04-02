import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { kMeansClustering, GeoPoint } from '@/lib/services/clustering'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

interface AutoAssignRequest {
    pedidoIds: string[]
    choferIds: string[]
    fecha: string
    turno: string
    ubicacionOrigenId: string
    maxParadasPorChofer?: number
    routePlans?: RoutePlan[]
    mode: 'preview' | 'confirm' | 'confirm-plans'
}

interface RoutePlan {
    choferId: string
    choferNombre: string
    vehiculoId?: string     // [NEW] Selected vehicle
    pedidos: {
        pedidoId: string
        clienteId: string
        clienteNombre: string
        direccion: string
        lat: number | null
        lng: number | null
        orden: number
    }[]
    totalDistance?: number   // km
    totalDuration?: number  // minutes
    sinCoordenadas: {
        pedidoId: string
        clienteId: string
        clienteNombre: string
        direccion: string
    }[]
}

// POST /api/rutas/auto-assign
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pedidoIds, choferIds, fecha, turno, ubicacionOrigenId, maxParadasPorChofer, routePlans: incomingPlans, mode } = body

        // Mode: confirm-plans — create routes from pre-built, user-reordered plans
        if (mode === 'confirm-plans' && incomingPlans?.length > 0) {
            const createdRoutes = []

            for (const plan of incomingPlans as RoutePlan[]) {
                const allPedidos = [
                    ...plan.pedidos.map((p: any) => ({ pedidoId: p.pedidoId, clienteId: p.clienteId })),
                    ...plan.sinCoordenadas.map((p: any) => ({ pedidoId: p.pedidoId, clienteId: p.clienteId }))
                ]
                if (allPedidos.length === 0) continue

                const ruta = await prisma.$transaction(async (tx) => {
                    const nuevaRuta = await tx.ruta.create({
                        data: {
                            choferId: plan.choferId,
                            vehiculoId: plan.vehiculoId || null,
                            fecha: new Date(fecha),
                            zona: null,
                            turno: turno || null,
                            ubicacionOrigenId: ubicacionOrigenId || null,
                            entregas: {
                                create: allPedidos.map((p, index) => ({
                                    pedidoId: p.pedidoId,
                                    clienteId: p.clienteId,
                                    orden: index
                                }))
                            }
                        },
                        include: { entregas: true }
                    })

                    await tx.pedido.updateMany({
                        where: { id: { in: allPedidos.map(p => p.pedidoId) } },
                        data: { estado: 'en_ruta' }
                    })

                    // Deduct stock
                    let finalOrigenId = ubicacionOrigenId
                    if (!finalOrigenId) {
                        const fabrica = await tx.ubicacion.findFirst({ where: { tipo: 'FABRICA' } })
                        finalOrigenId = fabrica?.id || ''
                    }
                    if (finalOrigenId) {
                        const detallesPedidos = await tx.detallePedido.findMany({
                            where: { pedidoId: { in: allPedidos.map(p => p.pedidoId) } },
                            include: { presentacion: true }
                        })
                        const consolidado: Record<string, { productoId: string; cantidad: number }> = {}
                        detallesPedidos.forEach(det => {
                            const key = det.presentacionId
                            if (!consolidado[key] && det.presentacion) consolidado[key] = { productoId: det.presentacion.productoId, cantidad: 0 }
                            if (consolidado[key]) consolidado[key].cantidad += det.cantidad
                        })
                        for (const [presId, info] of Object.entries(consolidado)) {
                            await tx.stockProducto.upsert({
                                where: { productoId_presentacionId_ubicacionId: { productoId: info.productoId, presentacionId: presId, ubicacionId: finalOrigenId } },
                                update: { cantidad: { decrement: info.cantidad } },
                                create: { productoId: info.productoId, presentacionId: presId, ubicacionId: finalOrigenId, cantidad: -info.cantidad }
                            })
                            await tx.movimientoProducto.create({
                                data: { tipo: 'salida_ruta', cantidad: info.cantidad, signo: 'salida', productoId: info.productoId, presentacionId: presId, ubicacionId: finalOrigenId, rutaId: nuevaRuta.id, observaciones: `Salida por Ruta - Chofer ${plan.choferNombre}` }
                            })
                        }
                    }
                    return nuevaRuta
                })
                createdRoutes.push(ruta)
            }

            return NextResponse.json({
                success: true,
                message: `${createdRoutes.length} rutas creadas con éxito`,
                rutasCreadas: createdRoutes.length,
            }, { status: 201 })
        }

        if (!pedidoIds?.length || !choferIds?.length || !fecha) {
            return NextResponse.json({ error: 'Faltan pedidos, choferes o fecha' }, { status: 400 })
        }

        // 1. Fetch pedidos with client coords
        const pedidos = await prisma.pedido.findMany({
            where: { id: { in: pedidoIds } },
            include: {
                cliente: {
                    select: { id: true, nombreComercial: true, direccion: true, zona: true, latitud: true, longitud: true }
                },
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } }
                        }
                    }
                }
            }
        })

        // 2. Fetch choferes
        const choferesList = await prisma.empleado.findMany({
            where: { id: { in: choferIds } },
            select: { id: true, nombre: true }
        })

        if (choferesList.length === 0) {
            return NextResponse.json({ error: 'No se encontraron los choferes seleccionados' }, { status: 400 })
        }

        // 3. Separate pedidos with and without coordinates
        const conCoords: GeoPoint[] = []
        const sinCoords: { pedidoId: string; clienteId: string; clienteNombre: string; direccion: string }[] = []

        FOR_PEDIDOS: for (const p of pedidos) {
            if (p.cliente.latitud && p.cliente.longitud) {
                conCoords.push({
                    id: p.id,
                    lat: p.cliente.latitud,
                    lng: p.cliente.longitud,
                    clienteId: p.cliente.id,
                    clienteNombre: p.cliente.nombreComercial
                })
            } else {
                sinCoords.push({
                    pedidoId: p.id,
                    clienteId: p.cliente.id,
                    clienteNombre: p.cliente.nombreComercial,
                    direccion: p.cliente.direccion || 'Sin dirección'
                })
            }
        }

        // 4. Run k-means clustering on pedidos with coordinates
        const k = choferIds.length
        const clusters = kMeansClustering(conCoords, k, 50, maxParadasPorChofer)

        // 5. Get origin coordinates
        const defaultOrigin = { lat: -34.8237468, lng: -58.1873516 }
        const origin = defaultOrigin

        // 6. For each cluster, optimize route order
        const routePlans: RoutePlan[] = []

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i]
            const chofer = choferesList[i % choferesList.length]
            
            let optimizedPoints = cluster.points
            let totalDistance: number | undefined
            let totalDuration: number | undefined

            if (cluster.points.length > 1 && GOOGLE_MAPS_API_KEY) {
                try {
                    const waypointsParam = cluster.points.map(p => `${p.lat},${p.lng}`).join('|')
                    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${origin.lat},${origin.lng}&waypoints=optimize:true|${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}&region=ar`
                    const res = await fetch(url)
                    const data = await res.json()
                    if (data.status === 'OK' && data.routes?.[0]) {
                        const route = data.routes[0]
                        optimizedPoints = route.waypoint_order.map((idx: number) => cluster.points[idx])
                        totalDistance = Math.round(route.legs.reduce((acc: number, leg: any) => acc + leg.distance.value, 0) / 1000 * 10) / 10
                        totalDuration = Math.round(route.legs.reduce((acc: number, leg: any) => acc + leg.duration.value, 0) / 60)
                    }
                } catch (e) {
                    console.error(`Optimize error:`, e)
                }
            }

            routePlans.push({
                choferId: chofer.id,
                choferNombre: chofer.nombre,
                pedidos: optimizedPoints.map((point, orden) => {
                    const pedido = pedidos.find(p => p.id === point.id)!
                    return {
                        pedidoId: point.id,
                        clienteId: point.clienteId,
                        clienteNombre: point.clienteNombre || pedido?.cliente.nombreComercial || '',
                        direccion: pedido?.cliente.direccion || '',
                        lat: point.lat,
                        lng: point.lng,
                        orden
                    }
                }),
                totalDistance,
                totalDuration,
                sinCoordenadas: []
            })
        }

        // 7. Distribute sinCoords
        if (sinCoords.length > 0 && routePlans.length > 0) {
            sinCoords.forEach((sc, idx) => {
                routePlans[idx % routePlans.length].sinCoordenadas.push(sc)
            })
        }

        // 8. Pre-assign vehicles from AsignacionVehiculo
        const day = new Date(fecha)
        day.setHours(0, 0, 0, 0)
        const assignments = await prisma.asignacionVehiculo.findMany({
            where: { fecha: day, turno: turno || undefined }
        })

        for (const plan of routePlans) {
            const match = assignments.find(a => a.empleadoId === plan.choferId)
            if (match) plan.vehiculoId = match.vehiculoId
        }

        return NextResponse.json({
            success: true,
            totalPedidos: pedidos.length,
            conCoordenadas: conCoords.length,
            sinCoordenadas: sinCoords.length,
            routePlans,
            choferesNoAsignados: choferesList.filter(c => !routePlans.some(p => p.choferId === c.id)).map(c => ({ id: c.id, nombre: c.nombre }))
        })

    } catch (error) {
        console.error('Auto-assign error:', error)
        return NextResponse.json({ error: 'Error en la asignación automática' }, { status: 500 })
    }
}
