import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { validarRangoCostosProduccion } from '@/lib/reportes/costos-produccion'
import { obtenerCostosProduccion } from '@/lib/services/reportes-costos-produccion'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const desde = params.get('desde') ?? ''
    const hasta = params.get('hasta') ?? ''
    const ubicacionId = params.get('ubicacionId') ?? ''
    try {
        validarRangoCostosProduccion(desde, hasta)
        if (ubicacionId && (ubicacionId.length > 100 || !/^[\w-]+$/.test(ubicacionId))) throw new Error('La sede seleccionada no es válida.')
        const data = await obtenerCostosProduccion({ desde, hasta, ubicacionId: ubicacionId || undefined })
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : ''
        if (/fechas válidas|período de hasta|sede seleccionada|Seleccioná una fábrica/.test(mensaje)) {
            return NextResponse.json({ error: mensaje }, { status: 400 })
        }
        console.error('Error al calcular costos de producción:', error)
        return NextResponse.json({ error: 'No se pudieron calcular los costos de producción.' }, { status: 500 })
    }
}
