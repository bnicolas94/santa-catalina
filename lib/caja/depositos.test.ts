import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularDiferenciaDeposito, validarMontoDeposito, validarObservacionesDiferencia } from './depositos'

test('calcula faltantes y sobrantes con precisión monetaria', () => {
    assert.equal(calcularDiferenciaDeposito(1_110_000, 1_002_000), -108_000)
    assert.equal(calcularDiferenciaDeposito(100.10, 100.20), 0.10)
})

test('el ejemplo real concilia la caja de origen y transfiere sólo lo contado', () => {
    const declarado = 1_110_000
    const real = 1_002_000
    const ajuste = calcularDiferenciaDeposito(declarado, real)

    assert.equal(ajuste, -108_000)
    assert.equal(declarado + ajuste - real, 0)
})

test('acepta monto real cero pero no un monto declarado cero', () => {
    assert.equal(validarMontoDeposito(0, true), 0)
    assert.throws(() => validarMontoDeposito(0), /mayor a cero/)
})

test('exige observación cuando existe una diferencia', () => {
    assert.equal(validarObservacionesDiferencia(0, ''), null)
    assert.equal(validarObservacionesDiferencia(-108_000, 'Faltante al contar'), 'Faltante al contar')
    assert.throws(() => validarObservacionesDiferencia(-1, ''), /observación/)
})
