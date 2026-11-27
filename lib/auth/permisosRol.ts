import type { PermissionKey } from '@/lib/access-control'

export type RolConPermisos = Partial<Record<PermissionKey, boolean>> | null | undefined

export function permisosDesdeRol(rol: RolConPermisos): Record<PermissionKey, boolean> | null {
    if (!rol) return null
    const permisoPersonal = rol.permisoPersonal === true
    return {
        permisoDashboard: rol.permisoDashboard === true,
        permisoStock: rol.permisoStock === true,
        permisoCaja: rol.permisoCaja === true,
        permisoPersonal,
        permisoPersonalLegajos: permisoPersonal,
        permisoPersonalAsistencia: permisoPersonal,
        permisoPersonalLiquidaciones: permisoPersonal,
        permisoPersonalPrestamos: permisoPersonal,
        permisoPersonalSanciones: permisoPersonal,
        permisoPersonalSeleccion: permisoPersonal,
        permisoProduccion: rol.permisoProduccion === true,
        permisoPantallaProduccion: rol.permisoPantallaProduccion === true,
        permisoCostos: rol.permisoCostos === true,
        permisoCompras: rol.permisoCompras === true,
        permisoClientes: rol.permisoClientes === true,
        permisoPedidos: rol.permisoPedidos === true,
        permisoLogistica: rol.permisoLogistica === true,
        permisoFlota: rol.permisoFlota === true,
        permisoReportes: rol.permisoReportes === true,
        permisoDiarioErrores: rol.permisoDiarioErrores === true,
        permisoAtencion: rol.permisoAtencion === true,
        permisoAtencionAdmin: rol.permisoAtencionAdmin === true,
    }
}

export function aplicarAccesosOperativos(
    permisos: Record<PermissionKey, boolean> | null,
    ubicacionTipo: unknown,
): Record<PermissionKey, boolean> | null {
    if (String(ubicacionTipo || '').toUpperCase() !== 'LOCAL') return permisos
    return { ...(permisos || permisosDesdeRol({})!), permisoCaja: true }
}
