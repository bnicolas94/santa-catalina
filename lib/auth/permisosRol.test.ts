import assert from 'node:assert/strict'
import test from 'node:test'

import { aplicarAccesosOperativos, permisosDesdeRol } from './permisosRol'

test('construye todos los permisos dinámicos desde el tipo de empleado', () => {
    assert.deepEqual(permisosDesdeRol({ permisoStock: true, permisoCaja: true, permisoProduccion: true, permisoFlota: true, permisoAtencion: true }), {
        permisoDashboard: false,
        permisoStock: true,
        permisoCaja: true,
        permisoPersonal: false,
        permisoProduccion: true,
        permisoCostos: false,
        permisoCompras: false,
        permisoClientes: false,
        permisoPedidos: false,
        permisoLogistica: false,
        permisoFlota: true,
        permisoReportes: false,
        permisoAtencion: true,
        permisoAtencionAdmin: false,
    })
})

test('el acceso operativo del local agrega Caja sin perder permisos del tipo', () => {
    const permisos = permisosDesdeRol({ permisoStock: true, permisoProduccion: true })
    assert.deepEqual(aplicarAccesosOperativos(permisos, 'LOCAL'), {
        permisoDashboard: false,
        permisoStock: true,
        permisoCaja: true,
        permisoPersonal: false,
        permisoProduccion: true,
        permisoCostos: false,
        permisoCompras: false,
        permisoClientes: false,
        permisoPedidos: false,
        permisoLogistica: false,
        permisoFlota: false,
        permisoReportes: false,
        permisoAtencion: false,
        permisoAtencionAdmin: false,
    })
})
