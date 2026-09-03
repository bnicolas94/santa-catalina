import test from 'node:test'
import assert from 'node:assert/strict'
import { cantidadGastoOpcional } from './validacion'

test('mantiene sin especificar las cantidades históricas o no informadas', () => {
    for (const valor of [undefined, null, '', '  ']) {
        assert.equal(cantidadGastoOpcional(valor), null)
    }
})

test('acepta cantidades de gasto positivas enteras y decimales con coma', () => {
    assert.equal(cantidadGastoOpcional('3'), 3)
    assert.equal(cantidadGastoOpcional('2,5'), 2.5)
    assert.equal(cantidadGastoOpcional(0.25), 0.25)
})

test('rechaza cantidades de gasto en cero, negativas o inválidas', () => {
    for (const valor of [0, '0', -2, '-2', 'abc', NaN, Infinity, true, [], {}]) {
        assert.throws(() => cantidadGastoOpcional(valor), /Cantidad del gasto/)
    }
})
