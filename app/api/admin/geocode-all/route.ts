import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
    if (!GOOGLE_MAPS_API_KEY) {
        return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY no configurada' }, { status: 500 })
    }

    try {
        const clientes = await prisma.cliente.findMany({
            where: {
                OR: [{ latitud: null }, { longitud: null }],
                direccion: { not: null }
            }
        })

        let successCount = 0
        let failCount = 0

        for (const cliente of clientes) {
            try {
                const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cliente.direccion!)}&key=${GOOGLE_MAPS_API_KEY}&region=ar`
                const res = await fetch(url)
                const data = await res.json()

                if (data.status === 'OK' && data.results.length > 0) {
                    const { lat, lng } = data.results[0].geometry.location
                    await prisma.cliente.update({
                        where: { id: cliente.id },
                        data: { latitud: lat, longitud: lng }
                    })
                    successCount++
                } else {
                    failCount++
                }
            } catch (e) {
                console.error(`Geocode error for client ${cliente.id}:`, e)
                failCount++
            }
        }

        return NextResponse.json({
            mensaje: `Proceso finalizado. Exitosos: ${successCount}, fallidos: ${failCount}`,
            successCount,
            failCount
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
