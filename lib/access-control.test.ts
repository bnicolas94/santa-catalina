import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessPath, getAccessRule } from './access-control'

test('ADMIN puede acceder a cualquier ruta protegida', () => {
    assert.equal(canAccessPath('/api/empleados/roles', { rol: 'ADMIN' }), true)
})

test('permisoPersonal habilita las API de RR. HH.', () => {
    const token = { rol: 'OPERARIO', permisos: { permisoPersonal: true } }
    assert.equal(canAccessPath('/api/empleados/abc', token), true)
    assert.equal(canAccessPath('/api/documentos-empleado', token), true)
    assert.equal(canAccessPath('/api/liquidaciones/final', token), true)
})

test('una sesión sin permisoPersonal no puede invocar RR. HH.', () => {
    const token = { rol: 'OPERARIO', permisos: { permisoProduccion: true } }
    assert.equal(canAccessPath('/api/empleados', token), false)
    assert.equal(canAccessPath('/api/reportes/rrhh', token), false)
})

test('sólo ADMIN puede administrar roles, incluso con permisoPersonal', () => {
    const token = { rol: 'ADMIN_OPS', permisos: { permisoPersonal: true } }
    assert.equal(canAccessPath('/api/empleados/roles', token), false)
})

test('las APIs internas del CRM exigen permisos de Atención', () => {
    assert.equal(
        canAccessPath('/api/internal/crm/customers/resolve', { rol: 'ATENCION', permisos: { permisoAtencion: true } }),
        true,
    )
    assert.equal(
        canAccessPath('/api/internal/crm/customers/resolve', { rol: 'OPERARIO', permisos: { permisoProduccion: true } }),
        false,
    )
})

test('la coincidencia usa límites de segmento y no prefijos parciales', () => {
    assert.equal(getAccessRule('/api/empleados-malicioso'), undefined)
    assert.equal(getAccessRule('/productos-copia'), undefined)
})

test('una ruta aún no clasificada conserva el comportamiento actual', () => {
    assert.equal(canAccessPath('/api/realtime/events', { rol: 'OPERARIO' }), true)
})

test('Caja queda aislada de usuarios con otros permisos', () => {
    assert.equal(
        canAccessPath('/api/caja/saldos', { rol: 'OPERARIO', permisos: { permisoProduccion: true } }),
        false
    )
    assert.equal(
        canAccessPath('/api/caja/saldos', { rol: 'OPERARIO', permisos: { permisoCaja: true } }),
        true
    )
})

test('permisoCompras habilita compras y proveedores sin abrir Caja', () => {
    const token = { rol: 'COMPRAS', permisos: { permisoCompras: true } }
    assert.equal(canAccessPath('/compras', token), true)
    assert.equal(canAccessPath('/api/compras/cuenta-corriente', token), true)
    assert.equal(canAccessPath('/proveedores', token), true)
    assert.equal(canAccessPath('/api/proveedores', token), true)
    assert.equal(canAccessPath('/caja', token), false)
})

test('el personal del LOCAL accede a Caja sin un permiso manual', () => {
    const token = {
        rol: 'OPERARIO',
        ubicacionTipo: 'LOCAL',
        permisos: { permisoProduccion: true },
    }

    assert.equal(canAccessPath('/caja', token), true)
    assert.equal(canAccessPath('/api/caja/config-deposito', token), true)
    assert.equal(canAccessPath('/costos', token), false)
})

test('la ubicación FABRICA no habilita Caja automáticamente', () => {
    assert.equal(
        canAccessPath('/caja', { rol: 'OPERARIO', ubicacionTipo: 'FABRICA', permisos: { permisoProduccion: true } }),
        false,
    )
})

test('Compras puede listar cajas de pago sin habilitar la administración de Caja', () => {
    const token = { rol: 'ADMIN_OPS', permisos: { permisoCompras: true } }
    assert.equal(canAccessPath('/api/compras/cajas', token), true)
    assert.equal(canAccessPath('/api/caja/saldos', token), false)
})

test('las mermas de Costos requieren permisoCostos', () => {
    assert.equal(
        canAccessPath('/api/costos/mermas', { rol: 'OPERARIO', permisos: { permisoCostos: true } }),
        true
    )
    assert.equal(
        canAccessPath('/api/costos/mermas', { rol: 'OPERARIO', permisos: { permisoStock: true } }),
        false
    )
})

test('las operaciones compartidas aceptan cualquiera de sus permisos válidos', () => {
    assert.equal(
        canAccessPath('/api/produccion/planificacion/descontar', { permisos: { permisoStock: true } }),
        true
    )
    assert.equal(
        canAccessPath('/api/productos', { permisos: { permisoProduccion: true } }),
        true
    )
})

test('endpoints administrativos no admiten permisos dinámicos', () => {
    assert.equal(
        canAccessPath('/api/admin/geocode-all', { rol: 'ADMIN_OPS', permisos: { permisoStock: true } }),
        false
    )
})

test('la entrega masiva de pedidos queda limitada a administración operativa', () => {
    assert.equal(canAccessPath('/api/pedidos/entregar-masivo', { rol: 'ADMIN_OPS' }), true)
    assert.equal(
        canAccessPath('/api/pedidos/entregar-masivo', { rol: 'OPERARIO', permisos: { permisoStock: true } }),
        false,
    )
})

test('Logística accede sólo a los directorios operativos mínimos', () => {
    const token = { rol: 'LOGISTICA' }
    assert.equal(canAccessPath('/api/operaciones/empleados', token), true)
    assert.equal(canAccessPath('/api/operaciones/ubicaciones', token), true)
    assert.equal(canAccessPath('/api/empleados', token), false)
    assert.equal(canAccessPath('/api/ubicaciones', token), false)
})

test('los roles completos siguen reservados a ADMIN', () => {
    const produccion = { rol: 'OPERARIO', permisos: { permisoProduccion: true } }
    assert.equal(canAccessPath('/api/operaciones/roles', produccion), true)
    assert.equal(canAccessPath('/api/empleados/roles', produccion), false)
})

test('Flota habilita vehículos, asignaciones y gastos sin abrir Logística', () => {
    const token = { rol: 'MECANICO', permisos: { permisoFlota: true } }
    assert.equal(canAccessPath('/logistica/flota/gastos', token), true)
    assert.equal(canAccessPath('/api/flota/vehiculos', token), true)
    assert.equal(canAccessPath('/api/logistica/flota/gastos', token), true)
    assert.equal(canAccessPath('/api/reportes/categorias', token), true)
    assert.equal(canAccessPath('/logistica/rutas', token), false)
    assert.equal(canAccessPath('/api/rutas', token), false)
})

test('Logística habilita rutas y entregas sin conceder gestión de Flota', () => {
    const token = { rol: 'DESPACHO', permisos: { permisoLogistica: true } }
    assert.equal(canAccessPath('/logistica/rutas', token), true)
    assert.equal(canAccessPath('/api/rutas/auto-assign', token), true)
    assert.equal(canAccessPath('/api/entregas/abc', token), true)
    assert.equal(canAccessPath('/logistica/flota/gastos', token), false)
    assert.equal(canAccessPath('/api/logistica/flota/gastos', token), false)
})

test('Clientes y Pedidos se pueden asignar de forma independiente', () => {
    const clientes = { permisos: { permisoClientes: true } }
    const pedidos = { permisos: { permisoPedidos: true } }
    assert.equal(canAccessPath('/clientes', clientes), true)
    assert.equal(canAccessPath('/pedidos', clientes), false)
    assert.equal(canAccessPath('/pedidos', pedidos), true)
    assert.equal(canAccessPath('/importar', pedidos), true)
    assert.equal(canAccessPath('/api/importar-pedidos/preview', pedidos), true)
})

test('Reportes habilita la página y sus fuentes de datos', () => {
    const token = { permisos: { permisoReportes: true } }
    assert.equal(canAccessPath('/reportes', token), true)
    assert.equal(canAccessPath('/api/reportes/rentabilidad', token), true)
    assert.equal(canAccessPath('/api/reportes/caja', token), true)
})

test('los permisos dinámicos pueden revocar accesos de nombres históricos', () => {
    assert.equal(canAccessPath('/logistica', { rol: 'LOGISTICA', permisos: { permisoLogistica: false } }), false)
    assert.equal(canAccessPath('/compras', { rol: 'ADMIN_OPS', permisos: { permisoCompras: false } }), false)
})

test('el respaldo por nombre histórico se conserva para cuentas aún no vinculadas', () => {
    assert.equal(canAccessPath('/logistica', { rol: 'LOGISTICA', permisos: null }), true)
    assert.equal(canAccessPath('/compras', { rol: 'ADMIN_OPS' }), true)
})
