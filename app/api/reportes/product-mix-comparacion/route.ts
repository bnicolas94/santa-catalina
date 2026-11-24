import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { validarFiltrosPedidosOnline } from '@/lib/reportes/pedidos-online'
import { obtenerComparacionProductMix } from '@/lib/services/reportes-product-mix-comparacion'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const input = { desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '',
        desdeReferencia: params.get('desdeReferencia') ?? '', hastaReferencia: params.get('hastaReferencia') ?? '',
        origen: params.get('origen') ?? '', modalidad: params.get('modalidad') ?? '',
        ubicacionId: params.get('ubicacionId') ?? '' }
    try {
        validarFiltrosPedidosOnline({ desde: input.desde, hasta: input.hasta })
        validarFiltrosPedidosOnline({ desde: input.desdeReferencia, hasta: input.hastaReferencia })
        if (input.origen && !['Pedidos_comunes', 'Pedidos_online'].includes(input.origen)) throw new Error('El origen seleccionado no es válido.')
        if (input.modalidad.length > 100) throw new Error('La modalidad seleccionada no es válida.')
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Filtros inválidos.' }, { status: 400 })
    }
    try {
        return NextResponse.json(await obtenerComparacionProductMix(input),
            { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error al comparar Product Mix.'
        if (/sede|ubicación del Sheet/i.test(mensaje)) return NextResponse.json({ error: mensaje }, { status: 400 })
        console.error('Error al comparar Product Mix:', error)
        return NextResponse.json({ error: 'No se pudieron leer los pedidos o las recetas para la comparación.' }, { status: 502 })
    }
}
