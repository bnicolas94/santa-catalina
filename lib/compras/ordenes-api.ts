import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { canAccessPath, type PermissionKey } from '@/lib/access-control'

export async function autorizarOrdenCompra() {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; name?: string; rol?: string; permisos?: Partial<Record<PermissionKey, boolean>> | null } | undefined
    if (!user?.id) return { rechazo: NextResponse.json({ error: 'Sesión requerida' }, { status: 401 }), user: null }
    if (!canAccessPath('/api/compras/ordenes', { rol: user.rol, permisos: user.permisos })) {
        return { rechazo: NextResponse.json({ error: 'No tenés permiso para Compras' }, { status: 403 }), user: null }
    }
    return { rechazo: null, user }
}
