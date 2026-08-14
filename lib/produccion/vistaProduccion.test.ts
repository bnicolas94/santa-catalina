import assert from 'node:assert/strict'
import test from 'node:test'

import { usaVistaOperativaProduccion } from './vistaProduccion'

test('ADMIN_OPS conserva la vista de gestión aunque también tenga Producción', () => {
    assert.equal(usaVistaOperativaProduccion('ADMIN_OPS', {
        permisoStock: true,
        permisoCaja: true,
        permisoProduccion: true,
    }), false)
})

test('un tipo con varios módulos conserva la navegación general', () => {
    assert.equal(usaVistaOperativaProduccion('ENCARGADO', {
        permisoStock: true,
        permisoProduccion: true,
    }), false)
})

test('un operario dedicado a Producción recibe la vista táctil', () => {
    assert.equal(usaVistaOperativaProduccion('OPERARIO', {
        permisoProduccion: true,
    }), true)
})

test('Coordinación de Producción utiliza la vista completa', () => {
    assert.equal(usaVistaOperativaProduccion('COORD_PROD', {
        permisoProduccion: true,
    }), false)
})
