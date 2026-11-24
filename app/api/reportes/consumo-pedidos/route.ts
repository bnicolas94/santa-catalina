import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { validarFiltrosPedidosOnline } from '@/lib/reportes/pedidos-online'
import { obtenerConsumoPedidos } from '@/lib/services/reportes-consumo-pedidos'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const input = {
        desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '',
        origen: params.get('origen') ?? '', modalidad: params.get('modalidad') ?? '',
        ubicacionId: params.get('ubicacionId') ?? '',
    }
    try {
        validarFiltrosPedidosOnline(input)
        if (input.origen && !['Pedidos_comunes', 'Pedidos_online'].includes(input.origen)) throw new Error('El origen seleccionado no es válido.')
        if (input.modalidad.length > 100) throw new Error('La modalidad seleccionada no es válida.')
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Filtros inválidos.' }, { status: 400 })
    }
    try {
        const data = await obtenerConsumoPedidos(input)
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error al calcular el consumo de insumos.'
        if (/sede|ubicación del Sheet/i.test(mensaje)) {
            return NextResponse.json({ error: mensaje }, { status: 400 })
        }
        console.error('Error al calcular consumo de pedidos:', error)
        return NextResponse.json({ error: 'No se pudieron leer pedidos o recetas. Revisá las integraciones del Sheet.' }, { status: 502 })
    }
}
