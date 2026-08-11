import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarNombreInsumo } from './nombres'

test('considera iguales los nombres aunque cambien tildes, espacios o mayúsculas', () => {
    assert.equal(normalizarNombreInsumo('  JAMÓN   Cocido '), normalizarNombreInsumo('jamon cocido'))
})
