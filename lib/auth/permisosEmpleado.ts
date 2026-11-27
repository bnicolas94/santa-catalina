import type { PermissionKey } from '@/lib/access-control'

export type EstadoPermisoEmpleado = 'HEREDAR' | 'PERMITIR' | 'DENEGAR'

export type PermisoEmpleadoPersistido = {
    clave: string
    permitido: boolean
}

export const PERMISOS_MODULO: ReadonlyArray<{
    clave: PermissionKey
    nombre: string
    descripcion: string
}> = [
    { clave: 'permisoDashboard', nombre: 'Dashboard', descripcion: 'Indicadores generales y pantalla de inicio.' },
    { clave: 'permisoStock', nombre: 'Stock', descripcion: 'Productos, insumos, conteos e inventario.' },
    { clave: 'permisoCompras', nombre: 'Compras', descripcion: 'Compras, proveedores y cuentas corrientes.' },
    { clave: 'permisoClientes', nombre: 'Clientes', descripcion: 'Alta, consulta y edición de clientes.' },
    { clave: 'permisoPedidos', nombre: 'Pedidos', descripcion: 'Pedidos, ventas e importación de planillas.' },
    { clave: 'permisoLogistica', nombre: 'Logística', descripcion: 'Repartos, entregas y operación logística.' },
    { clave: 'permisoFlota', nombre: 'Flota', descripcion: 'Vehículos, asignaciones, gastos y mantenimientos.' },
    { clave: 'permisoCaja', nombre: 'Caja', descripcion: 'Saldos, movimientos, depósitos y rendiciones.' },
    { clave: 'permisoPersonal', nombre: 'Personal', descripcion: 'Legajos, asistencia y liquidaciones.' },
    { clave: 'permisoProduccion', nombre: 'Producción', descripcion: 'Lotes, recetas y operación diaria.' },
    { clave: 'permisoPantallaProduccion', nombre: 'Pantalla de stock', descripcion: 'Consulta de stock, producción y pedidos por turno.' },
    { clave: 'permisoCostos', nombre: 'Costos', descripcion: 'Costeo y rentabilidad.' },
    { clave: 'permisoReportes', nombre: 'Reportes', descripcion: 'Indicadores y reportes generales de gestión.' },
    { clave: 'permisoDiarioErrores', nombre: 'Diario de errores', descripcion: 'Registro y seguimiento de errores diarios.' },
    { clave: 'permisoAtencion', nombre: 'Atención', descripcion: 'Bandeja, conversaciones y respuesta a clientes.' },
    { clave: 'permisoAtencionAdmin', nombre: 'Supervisión de atención', descripcion: 'Configuración, reasignaciones y métricas del equipo.' },
]

const CLAVES_PERMITIDAS = new Set<PermissionKey>(PERMISOS_MODULO.map(permiso => permiso.clave))

export function esClavePermiso(value: unknown): value is PermissionKey {
    return typeof value === 'string' && CLAVES_PERMITIDAS.has(value as PermissionKey)
}

export function aplicarPermisosIndividuales(
    permisosRol: Record<PermissionKey, boolean> | null,
    permisosIndividuales: PermisoEmpleadoPersistido[] | null | undefined,
): Record<PermissionKey, boolean> | null {
    const validos = (permisosIndividuales || []).filter(
        (permiso): permiso is PermisoEmpleadoPersistido => esClavePermiso(permiso.clave) && typeof permiso.permitido === 'boolean',
    )
    if (validos.length === 0) return permisosRol

    const efectivos = Object.fromEntries(
        PERMISOS_MODULO.map(({ clave }) => [clave, permisosRol?.[clave] === true]),
    ) as Record<PermissionKey, boolean>

    for (const permiso of validos) efectivos[permiso.clave as PermissionKey] = permiso.permitido
    return efectivos
}

export function normalizarPermisosIndividuales(input: unknown): Array<{ clave: PermissionKey; permitido: boolean }> {
    if (!Array.isArray(input)) throw new Error('La configuración de permisos individuales no es válida.')

    const normalizados = input.map((item) => {
        if (!item || typeof item !== 'object') throw new Error('La configuración de permisos individuales no es válida.')
        const candidato = item as { clave?: unknown; permitido?: unknown }
        if (!esClavePermiso(candidato.clave) || typeof candidato.permitido !== 'boolean') {
            throw new Error('Hay un permiso individual desconocido o incompleto.')
        }
        return { clave: candidato.clave, permitido: candidato.permitido }
    })

    if (new Set(normalizados.map(permiso => permiso.clave)).size !== normalizados.length) {
        throw new Error('Hay permisos individuales repetidos.')
    }
    return normalizados
}
