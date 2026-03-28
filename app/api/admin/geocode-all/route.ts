import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { geocodeAddress, geocodeRawAddress } from '@/lib/services/geocoding'

export async function POST() {
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
                // Try with components first if available
                let geocode = await geocodeAddress(cliente.calle, cliente.numero, cliente.localidad)
                
                // Fallback to raw address if components failed
                if (!geocode && cliente.direccion) {
                    geocode = await geocodeRawAddress(cliente.direccion)
                }

                if (geocode) {
                    await prisma.cliente.update({
                        where: { id: cliente.id },
                        data: { 
                            latitud: geocode.lat, 
                            longitud: geocode.lng 
                        }
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
