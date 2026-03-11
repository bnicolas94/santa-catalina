import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/clientes
export async function GET() {
    try {
        const clientes = await prisma.cliente.findMany({
            orderBy: { nombreComercial: 'asc' },
            include: { _count: { select: { pedidos: true } } },
        })
        return NextResponse.json(clientes)
    } catch (error) {
        console.error('Error fetching clientes:', error)
        return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })
    }
}

// POST /api/clientes
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nombreComercial, contactoNombre, contactoTelefono, calle, numero, localidad, zona, segmento, frecuenciaSemanal, pedidoPromedioU } = body

        if (!nombreComercial) {
            return NextResponse.json({ error: 'El nombre comercial es requerido' }, { status: 400 })
        }

        // Compute direccion from components
        const direccion = [calle, numero, localidad].filter(Boolean).join(', ') || null

        // Auto-geocode if we have an address
        let latitud: number | null = null
        let longitud: number | null = null
        if (direccion && process.env.GOOGLE_MAPS_API_KEY) {
            try {
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&key=${process.env.GOOGLE_MAPS_API_KEY}&region=ar`
                const geoRes = await fetch(geoUrl)
                const geoData = await geoRes.json()
                if (geoData.status === 'OK' && geoData.results?.length) {
                    latitud = geoData.results[0].geometry.location.lat
                    longitud = geoData.results[0].geometry.location.lng
                }
            } catch (e) { console.error('Geocode failed (non-blocking):', e) }
        }

        const cliente = await prisma.cliente.create({
            data: {
                nombreComercial,
                contactoNombre: contactoNombre || null,
                contactoTelefono: contactoTelefono || null,
                direccion,
                calle: calle || null,
                numero: numero || null,
                localidad: localidad || null,
                latitud,
                longitud,
                zona: zona || null,
                segmento: segmento || null,
                frecuenciaSemanal: parseInt(frecuenciaSemanal) || 0,
                pedidoPromedioU: parseInt(pedidoPromedioU) || 0,
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente, { status: 201 })
    } catch (error) {
        console.error('Error creating cliente:', error)
        return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 })
    }
}
