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
    grupo?: 'PERSONAL'
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
    { clave: 'permisoPersonalLegajos', nombre: 'Legajos', descripcion: 'Listado, altas, edición, documentos y datos laborales.', grupo: 'PERSONAL' },
    { clave: 'permisoPersonalAsistencia', nombre: 'Asistencia y horarios', descripcion: 'Fichadas, importaciones, turnos, licencias e inasistencias.', grupo: 'PERSONAL' },
    { clave: 'permisoPersonalLiquidaciones', nombre: 'Liquidaciones y recibos', descripcion: 'Liquidaciones semanales, finales, vacaciones, SAC y reportes de pagos.', grupo: 'PERSONAL' },
    { clave: 'permisoPersonalPrestamos', nombre: 'Préstamos', descripcion: 'Consulta, registro y seguimiento de préstamos y cuotas.', grupo: 'PERSONAL' },
    { clave: 'permisoPersonalSanciones', nombre: 'Sanciones', descripcion: 'Registro manual, consulta e impresión de apercibimientos.', grupo: 'PERSONAL' },
    { clave: 'permisoPersonalSeleccion', nombre: 'Selección de personal', descripcion: 'Postulaciones y evaluaciones de candidatos.', grupo: 'PERSONAL' },
    { clave: 'permisoProduccion', nombre: 'Producción', descripcion: 'Lotes, recetas y operación diaria.' },
    { clave: 'permisoPantallaProduccion', nombre: 'Pantalla de stock', descripcion: 'Consulta de stock, producción y pedidos por turno.' },
    { clave: 'permisoCostos', nombre: 'Costos', descripcion: 'Costeo y rentabilidad.' },
    { clave: 'permisoReportes', nombre: 'Reportes', descripcion: 'Indicadores y reportes generales de gestión.' },
    { clave: 'permisoDiarioErrores', nombre: 'Diario de errores', descripcion: 'Registro y seguimiento de errores diarios.' },
    { clave: 'permisoAtencion', nombre: 'Atención', descripcion: 'Bandeja, conversaciones y respuesta a clientes.' },
    { clave: 'permisoAtencionAdmin', nombre: 'Supervisión de atención', descripcion: 'Configuración, reasignaciones y métricas del equipo.' },
]

const CLAVES_PERMITIDAS = new Set<PermissionKey>(PERMISOS_MODULO.map(permiso => permiso.clave))

export const SUBPERMISOS_PERSONAL = PERMISOS_MODULO.filter(permiso => permiso.grupo === 'PERSONAL')
export const PERMISOS_PRINCIPALES = PERMISOS_MODULO.filter(permiso => !permiso.grupo)

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

    const excepcionPersonal = validos.find(permiso => permiso.clave === 'permisoPersonal')
    if (excepcionPersonal) {
        for (const permiso of SUBPERMISOS_PERSONAL) efectivos[permiso.clave] = excepcionPersonal.permitido
    }
    for (const permiso of validos) efectivos[permiso.clave as PermissionKey] = permiso.permitido
    efectivos.permisoPersonal = SUBPERMISOS_PERSONAL.some(permiso => efectivos[permiso.clave])
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
