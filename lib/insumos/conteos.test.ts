import test from 'node:test'
import assert from 'node:assert/strict'
import { cantidadSecundariaParaConteo } from './conteos'

test('el conteo en cero también deja en cero la cantidad secundaria', () => {
    assert.equal(cantidadSecundariaParaConteo(0, 25, -7.08), 0)
    assert.equal(cantidadSecundariaParaConteo(0, null, 2), 0)
})

test('calcula la cantidad secundaria desde la unidad principal', () => {
    assert.equal(cantidadSecundariaParaConteo(50, 25, 99), 2)
})

test('conserva la cantidad secundaria manual si no puede inferirla', () => {
    assert.equal(cantidadSecundariaParaConteo(12, null, 3), 3)
})
