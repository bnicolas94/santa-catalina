import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const clientCount = await prisma.cliente.count()
        const pedidoCount = await prisma.pedido.count()
        const rutaCount = await prisma.ruta.count()
        
        // Check if we have clients with coordinates
        const clientsWithCoords = await prisma.cliente.count({
            where: {
                latitud: { not: null },
                longitud: { not: null }
            }
        })

        const dbUrl = process.env.DATABASE_URL || 'NOT SET'
        const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@')

        return NextResponse.json({
            success: true,
            counts: {
                clientes: clientCount,
                clientesWithCoords: clientsWithCoords,
                pedidos: pedidoCount,
                rutas: rutaCount
            },
            env: {
                DATABASE_URL: maskedUrl,
                GOOGLE_MAP_KEY_SET: !!process.env.GOOGLE_MAPS_API_KEY
            }
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
