import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAccessPath, type PermissionKey } from '@/lib/access-control'
import { esFallaTransitoriaDeBase, obtenerPantallaStockProduccion } from '@/lib/services/pantalla-stock-produccion.service'

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
        const errorVisible = esFallaTransitoriaDeBase(error)
            ? 'No se pudo conectar con la base del ERP. La pantalla volverá a intentar automáticamente.'
            : /OneDrive|Excel|Paq\. Totales/i.test(mensaje)
                ? 'No se pudo leer el Excel de pedidos. La pantalla volverá a intentar automáticamente.'
                : 'No se pudo actualizar el stock y los pedidos. La pantalla volverá a intentar automáticamente.'
        return NextResponse.json(
            { error: errorVisible },
            { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        )
    }
}
