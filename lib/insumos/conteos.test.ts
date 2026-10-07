import test from 'node:test'
import assert from 'node:assert/strict'
import { cantidadSecundariaParaConteo, coincideStockConteo, parseCantidadConteo } from './conteos'

test('acepta cantidades de conteo con coma o punto y rechaza valores vacíos', () => {
    assert.equal(parseCantidadConteo('1,5'), 1.5)
    assert.equal(parseCantidadConteo('0'), 0)
    assert.ok(Number.isNaN(parseCantidadConteo('')))
    assert.ok(Number.isNaN(parseCantidadConteo('  ')))
    assert.ok(Number.isNaN(parseCantidadConteo('-2')))
    assert.ok(Number.isNaN(parseCantidadConteo('1.234,5')))
})

test('la confirmación detecta un cambio de stock posterior a la vista previa', () => {
    assert.equal(coincideStockConteo(10, 10), true)
    assert.equal(coincideStockConteo(11, 10), false)
    assert.equal(coincideStockConteo(0, NaN), false)
})

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
