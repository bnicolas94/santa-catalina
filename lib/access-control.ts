export type PermissionKey =
    | 'permisoDashboard'
    | 'permisoStock'
    | 'permisoCaja'
    | 'permisoPersonal'
    | 'permisoProduccion'
    | 'permisoCostos'

export type AccessToken = {
    rol?: string | null
    permisos?: Partial<Record<PermissionKey, boolean>> | null
}

type AccessRule = {
    path: string
    permissions?: PermissionKey[]
    legacyRoles?: string[]
}

// Las reglas más específicas deben declararse primero.
const accessRules: AccessRule[] = [
    // La administración de roles puede escalar privilegios y queda reservada a ADMIN.
    { path: '/api/empleados/roles', legacyRoles: ['ADMIN'] },
    { path: '/api/admin', legacyRoles: ['ADMIN'] },

    // Vistas mínimas de sólo lectura para pantallas operativas.
    { path: '/api/operaciones/roles', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/operaciones/empleados', permissions: ['permisoProduccion', 'permisoCaja'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'LOGISTICA'] },
    { path: '/api/operaciones/ubicaciones', permissions: ['permisoProduccion', 'permisoStock', 'permisoCaja'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'ADMIN_OPS', 'LOGISTICA'] },

    // Configuración y reportes globales reservados a administración.
    { path: '/api/reportes/config', legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/categorias', legacyRoles: ['ADMIN'] },

    // Caja y movimientos financieros.
    { path: '/api/caja', permissions: ['permisoCaja'], legacyRoles: ['ADMIN'] },
    { path: '/api/mercadopago/movimientos', permissions: ['permisoCaja'], legacyRoles: ['ADMIN'] },
    { path: '/api/conceptos', permissions: ['permisoCaja', 'permisoCostos'], legacyRoles: ['ADMIN'] },
    { path: '/api/gastos', permissions: ['permisoCaja', 'permisoCostos'], legacyRoles: ['ADMIN'] },
    { path: '/api/costos/mermas', permissions: ['permisoCostos'], legacyRoles: ['ADMIN'] },

    // Producción. El descuento de planificación puede ser operado también desde Stock.
    { path: '/api/produccion/planificacion/descontar', permissions: ['permisoProduccion', 'permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD'] },
    { path: '/api/produccion/planificacion/importar', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD'] },
    { path: '/api/produccion/planificacion/manual', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD'] },
    { path: '/api/produccion/planificacion', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'LOGISTICA'] },
    { path: '/api/produccion', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/lotes', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/movimientos-producto', permissions: ['permisoProduccion', 'permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },

    // Catálogo, compras y stock.
    { path: '/api/conteos-insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/familias-insumo', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/fichas-tecnicas', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/movimientos-stock', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/presentaciones', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/productos', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/proveedores', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/api/stock-producto', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/ubicaciones', permissions: ['permisoStock', 'permisoProduccion', 'permisoPersonal'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },

    // Métricas con una correspondencia inequívoca a un permiso.
    { path: '/api/dashboard', permissions: ['permisoDashboard'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/reportes/caja', permissions: ['permisoCaja'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/costos', permissions: ['permisoCostos'], legacyRoles: ['ADMIN'] },

    // API de Personal/RR. HH. Estas rutas antes sólo requerían una sesión válida.
    { path: '/api/documentos-empleado', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/conceptos-salariales', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/liquidaciones-finales', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/empleados', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/evaluaciones', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/fichadas', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/feriados', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/licencias', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/liquidaciones', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/prestamos', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/puestos', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/rrhh', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/turnos', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/uniformes', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },

    // Páginas protegidas existentes.
    { path: '/empleados', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/produccion-v2', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/produccion', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/productos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/conteos-insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/compras', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/stock', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/caja', permissions: ['permisoCaja'], legacyRoles: ['ADMIN'] },
    { path: '/costos', permissions: ['permisoCostos'], legacyRoles: ['ADMIN'] },
    { path: '/proveedores', legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/clientes', legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/pedidos', legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
]

function isPathWithin(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getAccessRule(pathname: string): AccessRule | undefined {
    return accessRules.find((rule) => isPathWithin(pathname, rule.path))
}

export function canAccessPath(pathname: string, token: AccessToken): boolean {
    if (token.rol === 'ADMIN') return true

    const rule = getAccessRule(pathname)
    if (!rule) return true

    if (rule.permissions?.some((permission) => token.permisos?.[permission] === true)) return true

    return rule.legacyRoles?.includes(token.rol || '') === true
}
