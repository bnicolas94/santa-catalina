import { NextResponse } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

// POST /api/geocode — Geocodificar una dirección
export async function POST(request: Request) {
    try {
        if (!GOOGLE_MAPS_API_KEY) {
            return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY no configurada' }, { status: 500 })
        }

        const { direccion } = await request.json()
        if (!direccion) {
            return NextResponse.json({ error: 'Dirección requerida' }, { status: 400 })
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&key=${GOOGLE_MAPS_API_KEY}&region=ar`
        const res = await fetch(url)
        const data = await res.json()

        if (data.status !== 'OK' || !data.results?.length) {
            return NextResponse.json({ error: `No se pudo geocodificar: ${data.status}`, status: data.status }, { status: 404 })
        }

        const location = data.results[0].geometry.location
        return NextResponse.json({
            lat: location.lat,
            lng: location.lng,
            formattedAddress: data.results[0].formatted_address,
        })
    } catch (error) {
        console.error('Geocode error:', error)
        return NextResponse.json({ error: 'Error al geocodificar' }, { status: 500 })
    }
}
