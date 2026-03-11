import { NextResponse } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

interface Waypoint {
    lat: number
    lng: number
    id: string // entregaId o pedidoId for mapping back
}

// POST /api/rutas/optimize — Optimizar orden de entregas
export async function POST(request: Request) {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY no configurada' }, { status: 500 })
        }

        const { waypoints, origin } = await request.json() as {
            waypoints: Waypoint[]
            origin?: { lat: number; lng: number } // punto de partida (fábrica)
        }

        if (!waypoints?.length || waypoints.length < 2) {
            // Con 0-1 paradas no hay nada que optimizar
            return NextResponse.json({
                optimizedOrder: waypoints?.map((_, i) => i) || [],
                totalDistance: 0,
                totalDuration: 0,
                waypoints: waypoints || [],
            })
        }

        // Use first waypoint as origin/destination if no origin provided (round trip from first stop)
        const start = origin || waypoints[0]
        const waypointsForApi = origin ? waypoints : waypoints.slice(1)

        const waypointsParam = waypointsForApi
            .map(w => `${w.lat},${w.lng}`)
            .join('|')

        const url = `https://maps.googleapis.com/maps/api/directions/json?` +
            `origin=${start.lat},${start.lng}` +
            `&destination=${start.lat},${start.lng}` + // round trip
            `&waypoints=optimize:true|${waypointsParam}` +
            `&key=${GOOGLE_MAPS_API_KEY}` +
            `&region=ar`

        const res = await fetch(url)
        const data = await res.json()

        if (data.status !== 'OK') {
            return NextResponse.json({ error: `Google Directions error: ${data.status}` }, { status: 400 })
        }

        const route = data.routes[0]
        const optimizedWaypointOrder: number[] = route.waypoint_order

        // Map back to original waypoint indices
        const optimizedOrder = origin
            ? optimizedWaypointOrder.map((i: number) => i)
            : [0, ...optimizedWaypointOrder.map((i: number) => i + 1)]

        // Calculate totals
        let totalDistance = 0
        let totalDuration = 0
        for (const leg of route.legs) {
            totalDistance += leg.distance.value // meters
            totalDuration += leg.duration.value // seconds
        }

        return NextResponse.json({
            optimizedOrder,
            totalDistance: Math.round(totalDistance / 1000 * 10) / 10, // km with 1 decimal
            totalDuration: Math.round(totalDuration / 60), // minutes
            waypointsOptimized: optimizedOrder.map((i: number) => waypoints[i]),
        })
    } catch (error) {
        console.error('Route optimization error:', error)
        return NextResponse.json({ error: 'Error al optimizar ruta' }, { status: 500 })
    }
}
