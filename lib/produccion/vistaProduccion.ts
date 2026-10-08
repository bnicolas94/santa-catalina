const rolesDeGestion = new Set(['ADMIN', 'ADMIN_OPS', 'COORD_PROD'])

export function usaVistaOperativaProduccion(
    rol: string | null | undefined,
    ubicacionTipo: string | null | undefined,
) {
    const rolNormalizado = String(rol || '').toUpperCase()
    const ubicacionNormalizada = String(ubicacionTipo || '').toUpperCase()

    if (ubicacionNormalizada !== 'FABRICA') return false
    if (rolesDeGestion.has(rolNormalizado)) return false

    // La interfaz es una decisión operativa por sede y tipo de usuario. Los
    // permisos determinan a qué módulos accede, pero no deben convertir la
    // pantalla táctil de Fábrica en el dashboard administrativo.
    return true
}
