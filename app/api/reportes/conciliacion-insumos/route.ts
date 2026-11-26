import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { listarConteosParaConciliacion, obtenerConciliacionInsumos } from '@/lib/services/reportes-conciliacion-insumos'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const ubicacionId = params.get('ubicacionId') ?? ''
    const inicioId = params.get('inicioId') ?? ''
    const finId = params.get('finId') ?? ''
    if (!ubicacionId || [ubicacionId, inicioId, finId].some(id => id.length > 100 || (id && !/^[\w-]+$/.test(id))) || Boolean(inicioId) !== Boolean(finId)) {
        return NextResponse.json({ error: 'Seleccioná una fábrica y dos conteos válidos.' }, { status: 400 })
    }
    try {
        const data = inicioId
            ? await obtenerConciliacionInsumos(ubicacionId, inicioId, finId)
            : await listarConteosParaConciliacion(ubicacionId)
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : ''
        if (/Elegí|Seleccioná/.test(mensaje)) return NextResponse.json({ error: mensaje }, { status: 400 })
        console.error('Error al conciliar insumos:', error)
        return NextResponse.json({ error: 'No se pudo calcular el control de insumos.' }, { status: 500 })
    }
}
