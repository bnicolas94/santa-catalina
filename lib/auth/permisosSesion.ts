import type { PermissionKey } from '@/lib/access-control'

type UsuarioSesion = {
    rol?: unknown
    permisos?: Partial<Record<PermissionKey, unknown>> | null
}

export function tienePermisoEnSesion(session: unknown, permiso: PermissionKey): boolean {
    const user = (session as { user?: UsuarioSesion } | null | undefined)?.user
    if (user?.rol === 'ADMIN' || user?.permisos?.[permiso] === true) return true
    if (permiso.startsWith('permisoPersonal') && permiso !== 'permisoPersonal') {
        return user?.permisos?.[permiso] === undefined && user?.permisos?.permisoPersonal === true
    }
    return false
}
