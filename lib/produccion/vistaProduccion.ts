type PermisosProduccion = {
    permisoDashboard?: boolean
    permisoStock?: boolean
    permisoCaja?: boolean
    permisoPersonal?: boolean
    permisoProduccion?: boolean
    permisoCostos?: boolean
}

const rolesDeGestion = new Set(['ADMIN', 'ADMIN_OPS', 'COORD_PROD'])

export function usaVistaOperativaProduccion(
    rol: string | null | undefined,
    permisos: PermisosProduccion | null | undefined,
) {
    const rolNormalizado = String(rol || '').toUpperCase()
    if (rolesDeGestion.has(rolNormalizado)) return false

    // La pantalla táctil oculta deliberadamente la navegación general. Sólo
    // corresponde cuando Producción es la única responsabilidad del usuario.
    const tieneOtroModulo = Boolean(
        permisos?.permisoDashboard
        || permisos?.permisoStock
        || permisos?.permisoCaja
        || permisos?.permisoPersonal
        || permisos?.permisoCostos,
    )

    return !tieneOtroModulo
}
