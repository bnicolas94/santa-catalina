import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { validarPeriodoPedidosLocal } from '@/lib/reportes/pedidos-local'
import { obtenerReportePedidosLocal } from '@/lib/services/reportes-pedidos-local'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const desde = params.get('desde') ?? ''
    const hasta = params.get('hasta') ?? ''
    const estado = params.get('estado') ?? 'entregado'
    try {
        validarPeriodoPedidosLocal(desde, hasta)
        if (!['entregado', 'todos'].includes(estado)) throw new Error('El estado seleccionado no es válido.')
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    }
    try {
        const data = await obtenerReportePedidosLocal({ desde, hasta, estado: estado as 'entregado' | 'todos', hoja: params.get('hoja') || undefined, ubicacion: params.get('ubicacion') || undefined })
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error al consultar pedidos de local:', error)
        return NextResponse.json({ error: 'No se pudo leer el Google Sheet. Reintentá en unos instantes o revisá la configuración de la integración en Caja.' }, { status: 502 })
    }
}
