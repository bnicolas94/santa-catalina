import type { PermissionKey } from '@/lib/access-control'

export type RolConPermisos = Partial<Record<PermissionKey, boolean>> | null | undefined

export function permisosDesdeRol(rol: RolConPermisos): Record<PermissionKey, boolean> | null {
    if (!rol) return null
    return {
        permisoDashboard: rol.permisoDashboard === true,
        permisoStock: rol.permisoStock === true,
        permisoCaja: rol.permisoCaja === true,
        permisoPersonal: rol.permisoPersonal === true,
        permisoProduccion: rol.permisoProduccion === true,
        permisoCostos: rol.permisoCostos === true,
        permisoAtencion: rol.permisoAtencion === true,
        permisoAtencionAdmin: rol.permisoAtencionAdmin === true,
    }
}

export function aplicarAccesosOperativos(
    permisos: Record<PermissionKey, boolean> | null,
    ubicacionTipo: unknown,
): Record<PermissionKey, boolean> | null {
    if (String(ubicacionTipo || '').toUpperCase() !== 'LOCAL') return permisos
    return {
        permisoDashboard: permisos?.permisoDashboard === true,
        permisoStock: permisos?.permisoStock === true,
        permisoCaja: true,
        permisoPersonal: permisos?.permisoPersonal === true,
        permisoProduccion: permisos?.permisoProduccion === true,
        permisoCostos: permisos?.permisoCostos === true,
        permisoAtencion: permisos?.permisoAtencion === true,
        permisoAtencionAdmin: permisos?.permisoAtencionAdmin === true,
    }
}
