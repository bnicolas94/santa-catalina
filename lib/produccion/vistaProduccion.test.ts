import assert from 'node:assert/strict'
import test from 'node:test'

import { usaVistaOperativaProduccion } from './vistaProduccion'

test('ADMIN_OPS conserva la vista de gestión aunque también tenga Producción', () => {
    assert.equal(usaVistaOperativaProduccion('ADMIN_OPS', 'FABRICA'), false)
})

test('un operador de Fábrica conserva la vista táctil aunque tenga otros módulos', () => {
    assert.equal(usaVistaOperativaProduccion('ENCARGADO', 'FABRICA'), true)
})

test('un operario dedicado a Producción recibe la vista táctil', () => {
    assert.equal(usaVistaOperativaProduccion('OPERARIO', 'FABRICA'), true)
})

test('Coordinación de Producción utiliza la vista completa', () => {
    assert.equal(usaVistaOperativaProduccion('COORD_PROD', 'FABRICA'), false)
})

test('el personal del Local no recibe la vista táctil de Fábrica', () => {
    assert.equal(usaVistaOperativaProduccion('OPERARIO', 'LOCAL'), false)
})
