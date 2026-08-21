import type { PermissionKey } from '@/lib/access-control'

type UsuarioSesion = {
    rol?: unknown
    permisos?: Partial<Record<PermissionKey, unknown>> | null
}

export function tienePermisoEnSesion(session: unknown, permiso: PermissionKey): boolean {
    const user = (session as { user?: UsuarioSesion } | null | undefined)?.user
    return user?.rol === 'ADMIN' || user?.permisos?.[permiso] === true
}
