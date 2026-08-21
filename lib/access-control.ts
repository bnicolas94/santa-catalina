export type PermissionKey =
    | 'permisoDashboard'
    | 'permisoStock'
    | 'permisoCaja'
    | 'permisoPersonal'
    | 'permisoProduccion'
    | 'permisoCostos'
    | 'permisoCompras'
    | 'permisoClientes'
    | 'permisoPedidos'
    | 'permisoLogistica'
    | 'permisoFlota'
    | 'permisoReportes'
    | 'permisoAtencion'
    | 'permisoAtencionAdmin'

export type AccessToken = {
    rol?: string | null
    ubicacionTipo?: string | null
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
    { path: '/api/internal/crm', permissions: ['permisoAtencion', 'permisoAtencionAdmin'], legacyRoles: ['ADMIN'] },
    { path: '/api/pedidos/entregar-masivo', legacyRoles: ['ADMIN', 'ADMIN_OPS'] },

    // Vistas mínimas de sólo lectura para pantallas operativas.
    { path: '/api/operaciones/roles', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/operaciones/empleados', permissions: ['permisoProduccion', 'permisoCaja', 'permisoLogistica', 'permisoFlota'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'LOGISTICA'] },
    { path: '/api/operaciones/ubicaciones', permissions: ['permisoProduccion', 'permisoStock', 'permisoCaja', 'permisoLogistica'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'ADMIN_OPS', 'LOGISTICA'] },

    // Lecturas auxiliares de Reportes y Flota. Las mutaciones sensibles vuelven
    // a exigir ADMIN dentro de cada handler porque el middleware no distingue métodos.
    { path: '/api/reportes/config', permissions: ['permisoReportes'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/categorias', permissions: ['permisoReportes', 'permisoFlota'], legacyRoles: ['ADMIN'] },

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
    { path: '/api/produccion/planificacion', permissions: ['permisoProduccion', 'permisoLogistica'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO', 'LOGISTICA'] },
    { path: '/api/produccion', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/lotes', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/api/movimientos-producto', permissions: ['permisoProduccion', 'permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },

    // Catálogo, compras y stock.
    { path: '/api/compras', permissions: ['permisoCompras'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/conteos-insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/familias-insumo', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/fichas-tecnicas', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/movimientos-stock', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/presentaciones', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/productos', permissions: ['permisoStock', 'permisoProduccion', 'permisoPedidos'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/proveedores', permissions: ['permisoCompras'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/api/stock-producto', permissions: ['permisoStock', 'permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/ubicaciones', permissions: ['permisoStock', 'permisoProduccion', 'permisoPersonal'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },

    // Métricas con una correspondencia inequívoca a un permiso.
    { path: '/api/dashboard', permissions: ['permisoDashboard'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/api/reportes/caja', permissions: ['permisoCaja', 'permisoReportes'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/costos', permissions: ['permisoCostos', 'permisoReportes'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes/rrhh', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/reportes', permissions: ['permisoReportes'], legacyRoles: ['ADMIN'] },

    // Clientes, pedidos e importaciones comerciales.
    { path: '/api/importar-pedidos-local', permissions: ['permisoPedidos'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/api/importar-pedidos', permissions: ['permisoPedidos'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/api/clientes', permissions: ['permisoClientes', 'permisoPedidos', 'permisoLogistica'], legacyRoles: ['ADMIN', 'ADMIN_OPS', 'LOGISTICA'] },
    { path: '/api/pedidos', permissions: ['permisoPedidos', 'permisoLogistica'], legacyRoles: ['ADMIN', 'ADMIN_OPS', 'LOGISTICA'] },

    // Logística y Flota son módulos independientes. Las reglas de Flota deben
    // preceder al prefijo general /logistica.
    { path: '/api/logistica/flota', permissions: ['permisoFlota'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/api/flota', permissions: ['permisoFlota', 'permisoLogistica'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/api/logistica', permissions: ['permisoLogistica'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/api/rutas', permissions: ['permisoLogistica'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/api/entregas', permissions: ['permisoLogistica'], legacyRoles: ['ADMIN', 'LOGISTICA'] },

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
    { path: '/api/turnos', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/api/uniformes', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },

    // Páginas protegidas existentes.
    { path: '/empleados', permissions: ['permisoPersonal'], legacyRoles: ['ADMIN'] },
    { path: '/produccion-v2', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/produccion', permissions: ['permisoProduccion'], legacyRoles: ['ADMIN', 'COORD_PROD', 'OPERARIO'] },
    { path: '/productos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/conteos-insumos', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/compras', permissions: ['permisoCompras'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/stock', permissions: ['permisoStock'], legacyRoles: ['ADMIN', 'COORD_PROD', 'ADMIN_OPS'] },
    { path: '/caja', permissions: ['permisoCaja'], legacyRoles: ['ADMIN'] },
    { path: '/costos', permissions: ['permisoCostos'], legacyRoles: ['ADMIN'] },
    { path: '/proveedores', permissions: ['permisoCompras'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/clientes', permissions: ['permisoClientes'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/pedidos', permissions: ['permisoPedidos'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/importar', permissions: ['permisoPedidos'], legacyRoles: ['ADMIN', 'ADMIN_OPS'] },
    { path: '/logistica/flota', permissions: ['permisoFlota'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/logistica', permissions: ['permisoLogistica'], legacyRoles: ['ADMIN', 'LOGISTICA'] },
    { path: '/reportes', permissions: ['permisoReportes'], legacyRoles: ['ADMIN'] },
]

function isPathWithin(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getAccessRule(pathname: string): AccessRule | undefined {
    return accessRules.find((rule) => isPathWithin(pathname, rule.path))
}

export function canAccessPath(pathname: string, token: AccessToken): boolean {
    if (token.rol === 'ADMIN') return true

    // El personal asignado al local necesita Caja para registrar el depósito
    // diario, aunque su rol no tenga el permiso configurado manualmente.
    if (
        token.ubicacionTipo?.toUpperCase() === 'LOCAL'
        && (isPathWithin(pathname, '/caja') || isPathWithin(pathname, '/api/caja'))
    ) {
        return true
    }

    const rule = getAccessRule(pathname)
    if (!rule) return true

    if (rule.permissions?.some((permission) => token.permisos?.[permission] === true)) return true

    // Los nombres históricos sólo son un respaldo para cuentas que todavía no
    // están vinculadas a un RolEmpleado. Cuando existe un mapa de permisos, las
    // casillas configuradas son la fuente de verdad y también deben poder revocar.
    if (rule.permissions && token.permisos != null) return false

    return rule.legacyRoles?.includes(token.rol || '') === true
}
