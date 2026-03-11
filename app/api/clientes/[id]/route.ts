import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/clientes/:id
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        // Auto-prefix "Calle " if calle is just a number
        let calleFormatted = body.calle
        if (calleFormatted !== undefined && calleFormatted !== null) {
            if (/^\d+$/.test(calleFormatted.toString().trim())) {
                calleFormatted = `Calle ${calleFormatted.toString().trim()}`
            }
        }

        // Recompute direccion if address components provided
        const hasAddressChange = calleFormatted !== undefined || body.numero !== undefined || body.localidad !== undefined
        const direccionComputed = hasAddressChange
            ? [calleFormatted, body.numero, body.localidad].filter(Boolean).join(', ') || null
            : undefined

        // Auto-geocode if address changed
        let latitud: number | undefined
        let longitud: number | undefined
        if (direccionComputed && process.env.GOOGLE_MAPS_API_KEY) {
            try {
                // Determine the locality to help geocoding (use body.localidad, or existing, or default)
                // Use the string components explicitly to bypass formatting errors
                const queryAddress = [calleFormatted, body.numero, body.localidad || 'Buenos Aires'].filter(Boolean).join(', ')
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${process.env.GOOGLE_MAPS_API_KEY}&region=ar`
                const geoRes = await fetch(geoUrl)
                const geoData = await geoRes.json()
                if (geoData.status === 'OK' && geoData.results?.length) {
                    latitud = geoData.results[0].geometry.location.lat
                    longitud = geoData.results[0].geometry.location.lng
                }
            } catch (e) { console.error('Geocode failed on update:', e) }
        }

        const cliente = await prisma.cliente.update({
            where: { id },
            data: {
                ...(body.nombreComercial !== undefined && { nombreComercial: body.nombreComercial }),
                ...(body.contactoNombre !== undefined && { contactoNombre: body.contactoNombre || null }),
                ...(body.contactoTelefono !== undefined && { contactoTelefono: body.contactoTelefono || null }),
                ...(direccionComputed !== undefined && { direccion: direccionComputed }),
                ...(calleFormatted !== undefined && { calle: calleFormatted || null }),
                ...(body.numero !== undefined && { numero: body.numero || null }),
                ...(body.localidad !== undefined && { localidad: body.localidad || null }),
                ...(latitud !== undefined && { latitud }),
                ...(longitud !== undefined && { longitud }),
                ...(body.zona !== undefined && { zona: body.zona || null }),
                ...(body.segmento !== undefined && { segmento: body.segmento || null }),
                ...(body.frecuenciaSemanal !== undefined && { frecuenciaSemanal: parseInt(body.frecuenciaSemanal) || 0 }),
                ...(body.pedidoPromedioU !== undefined && { pedidoPromedioU: parseInt(body.pedidoPromedioU) || 0 }),
                ...(body.activo !== undefined && { activo: body.activo }),
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente)
    } catch (error: any) {
        console.error('Error updating cliente:', error)
        return NextResponse.json({ error: error?.message || 'Error al actualizar cliente' }, { status: 500 })
    }
}

// DELETE /api/clientes/:id
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await prisma.cliente.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting cliente:', error)
        return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 })
    }
}
