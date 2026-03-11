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

        // Recompute direccion if address components provided
        const hasAddressChange = body.calle !== undefined || body.numero !== undefined || body.localidad !== undefined
        const direccionComputed = hasAddressChange
            ? [body.calle, body.numero, body.localidad].filter(Boolean).join(', ') || null
            : undefined

        // Auto-geocode if address changed
        let latitud: number | undefined
        let longitud: number | undefined
        if (direccionComputed && process.env.GOOGLE_MAPS_API_KEY) {
            try {
                const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccionComputed)}&key=${process.env.GOOGLE_MAPS_API_KEY}&region=ar`
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
                ...(body.calle !== undefined && { calle: body.calle || null }),
                ...(body.numero !== undefined && { numero: body.numero || null }),
                ...(body.localidad !== undefined && { localidad: body.localidad || null }),
                ...(latitud !== undefined && { latitud }),
                ...(longitud !== undefined && { longitud }),
                ...(body.zona !== undefined && { zona: body.zona || null }),
                ...(body.segmento !== undefined && { segmento: body.segmento || null }),
                ...(body.frecuenciaSemanal !== undefined && { frecuenciaSemanal: parseInt(body.frecuenciaSemanal) }),
                ...(body.pedidoPromedioU !== undefined && { pedidoPromedioU: parseInt(body.pedidoPromedioU) }),
                ...(body.activo !== undefined && { activo: body.activo }),
            },
            include: { _count: { select: { pedidos: true } } },
        })

        return NextResponse.json(cliente)
    } catch (error) {
        console.error('Error updating cliente:', error)
        return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 })
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
