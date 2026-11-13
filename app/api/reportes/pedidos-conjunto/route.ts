import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { validarFiltrosPedidosOnline } from '@/lib/reportes/pedidos-online'
import { obtenerReportePedidosConjunto } from '@/lib/services/reportes-pedidos-conjunto'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para consultar el reporte.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) return NextResponse.json({ error: 'No tenés permiso para consultar reportes.' }, { status: 403 })
    const params = new URL(request.url).searchParams
    const filtros = {
        desde: params.get('desde') ?? '', hasta: params.get('hasta') ?? '', fechaComparacion: params.get('fechaComparacion') ?? '', origen: params.get('origen') ?? '',
        modalidad: params.get('modalidad') ?? '', ubicacion: params.get('ubicacion') ?? '',
        estado: params.get('estado') ?? '', buscar: params.get('buscar') ?? '',
        pagina: Number(params.get('pagina') ?? 1),
    }
    const exportar = params.get('formato') === 'csv'
    try { validarFiltrosPedidosOnline(filtros) }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }) }
    try {
        const reporte = await obtenerReportePedidosConjunto({ ...filtros, todos: exportar })
        if (exportar) {
            if (reporte.totalFilas > 10_000) return NextResponse.json({ error: 'La exportación supera 10.000 pedidos. Seleccioná un período menor.' }, { status: 400 })
            const seguro = (valor: unknown) => {
                const texto = String(valor ?? '')
                const neutralizado = /^[\s\u0000-\u001f]*[=+\-@]/.test(texto) ? `'${texto}` : texto
                return `"${neutralizado.replace(/"/g, '""')}"`
            }
            const encabezados = ['Origen', 'Fecha Entrega', 'Fecha/Hora de registro', 'ID', 'Nombre', 'Apellido', 'Teléfono', 'Dirección', 'Producto', 'Cantidad (sándwiches)', 'Paquetes', 'Modalidad', 'Ubicación', 'Estado', 'Pago', 'Precio', 'Observaciones', 'Duplicado', 'Conflicto']
            const lineas = reporte.registros.map(x => [x.origen, x.fechaEntrega, x.fecha, x.id, x.nombre, x.apellido, x.telefono, x.direccion, x.producto,
                x.cantidad, x.paquetes, x.modalidad, x.ubicacion, x.estado, x.pago, x.precio, x.observaciones, x.duplicado, x.conflicto].map(seguro).join(','))
            return new Response(`\uFEFF${[encabezados.map(seguro).join(','), ...lineas].join('\r\n')}`, {
                headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pedidos-conjunto.csv"', 'Cache-Control': 'private, no-store' },
            })
        }
        return NextResponse.json(reporte, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error al consultar pedidos conjuntos:', error)
        return NextResponse.json({ error: 'No se pudieron leer las hojas. Revisá el acceso y las columnas de Pedidos_comunes y Pedidos_online.' }, { status: 502 })
    }
}
