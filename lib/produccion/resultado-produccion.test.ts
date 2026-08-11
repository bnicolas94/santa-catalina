import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularResultadoProduccion } from './resultado-produccion'

test('14 producidos y 1 rechazado dejan 13 paquetes buenos', () => {
    assert.deepEqual(calcularResultadoProduccion(14, 1), {
        totalProducido: 14,
        paquetesBuenos: 13,
        paquetesRechazados: 1,
    })
})

test('rechaza una cantidad mayor al total producido', () => {
    assert.throws(
        () => calcularResultadoProduccion(13, 14),
        /no pueden superar el total producido/,
    )
})
