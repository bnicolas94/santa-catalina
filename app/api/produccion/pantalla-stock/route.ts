import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAccessPath, type PermissionKey } from '@/lib/access-control'
import { esFallaTransitoriaDeBase, obtenerPantallaStockProduccion } from '@/lib/services/pantalla-stock-produccion.service'

function detalleLecturaExcel(error: unknown) {
    const mensaje = error instanceof Error ? error.message : ''
    const codigo = (error as { code?: string } | null)?.code
    if (/^OneDrive respondió \d{3}\.$/.test(mensaje)) return mensaje
    if (/^OneDrive (no respondió a tiempo|no devolvió un archivo Excel|redirigió fuera de los dominios permitidos)\.$/.test(mensaje)) return mensaje
    if (/^El Excel (no contiene la pestaña Paq\. Totales|supera el límite de 10 MB)\.$/.test(mensaje)) return mensaje
    if (/^Se esperaban los totales de una sola fila para \d{4}-\d{2}-\d{2}\.$/.test(mensaje)) return mensaje
    if (/^Cambió (el encabezado|la columna) /.test(mensaje)) return 'Cambió la estructura de Paq. Totales.'
    if (['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(codigo ?? '')) return `Falló la conexión con OneDrive (${codigo}).`
    return 'Error de lectura sin clasificar; consultar el registro del servidor.'
}

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión para ver la pantalla de producción.' }, { status: 401 })
    const usuario = session.user as { rol?: string; permisos?: Partial<Record<PermissionKey, boolean>> | null } | undefined
    if (!canAccessPath('/api/produccion/pantalla-stock', { rol: usuario?.rol, permisos: usuario?.permisos })) {
        return NextResponse.json({ error: 'No tenés permiso para ver la pantalla de stock.' }, { status: 403 })
    }
    try {
        return NextResponse.json(await obtenerPantallaStockProduccion(), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Error en pantalla de stock de producción:', error)
        const mensaje = error instanceof Error ? error.message : ''
        const esErrorExcel = /OneDrive|Excel|Paq\. Totales/i.test(mensaje)
        const errorVisible = esFallaTransitoriaDeBase(error)
            ? 'No se pudo conectar con la base del ERP. La pantalla volverá a intentar automáticamente.'
            : esErrorExcel
                ? 'No se pudo leer el Excel de pedidos. La pantalla volverá a intentar automáticamente.'
                : 'No se pudo actualizar el stock y los pedidos. La pantalla volverá a intentar automáticamente.'
        return NextResponse.json(
            { error: usuario?.rol === 'ADMIN' && esErrorExcel
                ? `${errorVisible} Detalle: ${detalleLecturaExcel(error)}`
                : errorVisible },
            { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        )
    }
}
