import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularCostoReceta, calcularResultadoConMerma, extraerMotivoMerma } from './mermas-costos'

test('calcularCostoReceta valoriza cantidades y costo unitario', () => {
    const costo = calcularCostoReceta([
        { cantidadPorUnidad: 0.1, merma: 0, insumo: { precioUnitario: 1000 } },
        { cantidadPorUnidad: 0.05, merma: 0, insumo: { precioUnitario: 500 } }
    ])

    assert.equal(costo, 125)
})

test('calcularCostoReceta incorpora la merma técnica de la ficha', () => {
    const costo = calcularCostoReceta([
        { cantidadPorUnidad: 0.9, merma: 10, insumo: { precioUnitario: 100 } }
    ])

    assert.equal(costo, 100)
})

test('extraerMotivoMerma recupera el motivo de observaciones históricas', () => {
    assert.equal(extraerMotivoMerma('Merma 3 planchas — Vencimiento'), 'Vencimiento')
    assert.equal(extraerMotivoMerma(null), 'Sin especificar')
})

test('la merma reduce rentabilidad cuando el CMV surge de recetas', () => {
    assert.deepEqual(calcularResultadoConMerma(1000, 300, 100, false), {
        mermaImpactaResultado: true,
        rentabilidadNeta: 600
    })
})

test('la merma no se descuenta dos veces cuando el CMV usa compras', () => {
    assert.deepEqual(calcularResultadoConMerma(1000, 300, 100, true), {
        mermaImpactaResultado: false,
        rentabilidadNeta: 700
    })
})
