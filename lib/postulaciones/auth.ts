import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'

export async function autorizarPostulaciones() {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string } | undefined
    if (!user?.id) return { rechazo: NextResponse.json({ error: 'Sesión requerida' }, { status: 401 }), id: null }
    if (!tienePermisoEnSesion(session, 'permisoPersonal')) return { rechazo: NextResponse.json({ error: 'Sin permiso de Personal' }, { status: 403 }), id: null }
    return { rechazo: null, id: user.id }
}
