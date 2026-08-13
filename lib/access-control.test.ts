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
    const token = { rol: 'ADMIN_OPS', permisos: { permisoStock: true } }
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
