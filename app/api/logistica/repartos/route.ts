import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { calcularReporteRepartos, validarFiltrosRepartos } from '@/lib/logistica/repartos-sheet'
import { obtenerFuentesPedidosConjunto } from '@/lib/services/reportes-pedidos-conjunto'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar repartos.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoLogistica')) return NextResponse.json({ error: 'No tenés permiso de Logística.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const filtros = { desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '', chofer: params.get('chofer') ?? '',
        turno: params.get('turno') ?? '', pago: params.get('pago') ?? '', origen: params.get('origen') ?? '', buscar: params.get('buscar') ?? '' }
    try { validarFiltrosRepartos(filtros) }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
    try {
        const { fuentes, actualizado } = await obtenerFuentesPedidosConjunto()
        const reporte = { ...calcularReporteRepartos(fuentes, filtros), actualizado }
        if (params.get('formato') === 'csv') {
            if (reporte.registros.length > 10_000) return NextResponse.json({ error: 'La exportación supera 10.000 pedidos. Elegí un período menor.' }, { status: 400 })
            const seguro = (valor: unknown) => {
                const texto = String(valor ?? '')
                return `"${(/^[\s\u0000-\u001f]*[=+\-@]/.test(texto) ? `'${texto}` : texto).replace(/"/g, '""')}"`
            }
            const encabezados = ['Fecha Entrega', 'Turno', 'Chofer', 'Origen', 'ID', 'Cliente', 'Dirección', 'Ubicación', 'Pago', 'Ingreso esperado']
            const lineas = reporte.registros.map(r => [r.fecha, r.turno, r.chofer, r.origen, r.id, r.nombre, r.direccion, r.ubicacion, r.pago, r.importe].map(seguro).join(','))
            return new Response(`\uFEFF${[encabezados.map(seguro).join(','), ...lineas].join('\r\n')}`, { headers: {
                'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="repartos-sheet.csv"', 'Cache-Control': 'private, no-store' } })
        }
        return NextResponse.json(reporte, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error al consultar repartos del Sheet:', error)
        return NextResponse.json({ error: 'No se pudieron leer las hojas de pedidos. Revisá la configuración y el acceso al Google Sheet.' }, { status: 502 })
    }
}
