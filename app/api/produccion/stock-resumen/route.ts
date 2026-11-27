import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { esRolGestionProduccion } from '@/lib/produccion/vistaProduccion'
import { obtenerResumenStockProduccion } from '@/lib/services/produccion-stock-resumen.service'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el stock.' }, { status: 401 })
    const rol = String((session.user as { rol?: string }).rol || '').toUpperCase()
    if (!esRolGestionProduccion(rol)) return NextResponse.json({ error: 'Esta conciliación está disponible sólo en la vista de gestión.' }, { status: 403 })
    const fecha = new URL(request.url).searchParams.get('fecha') || ''
    try {
        return NextResponse.json(await obtenerResumenStockProduccion(fecha), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error al cruzar producción, ventas y stock:', error)
        const message = error instanceof Error ? error.message : 'No se pudo calcular el stock.'
        return NextResponse.json({ error: message }, { status: message.includes('fecha') ? 400 : 500 })
    }
}
