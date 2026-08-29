import test from 'node:test'
import assert from 'node:assert/strict'
import { separarHorasExtrasYAdeudadas } from './ajustesHorasExtras'

test('separa las horas semanales de las horas cargadas como deuda', () => {
    assert.deepEqual(separarHorasExtrasYAdeudadas({
        horasExtras: 0.5,
        ajusteHorasExtras: 2,
        montoHorasExtras: 16_840,
        desglose: [{ valorExtra: 3_368 }],
    }), {
        horasExtras: 0.5,
        horasAdeudadas: 2,
        montoHorasExtras: 3_368,
        montoHorasAdeudadas: 13_472,
    })
})

test('admite el formato de desglose anidado y ajustes negativos', () => {
    assert.deepEqual(separarHorasExtrasYAdeudadas({
        horasExtras: 2,
        ajusteHorasExtras: -0.5,
        montoHorasExtras: 9_000,
        desglose: { desglosePorDia: [{ valorExtra: 12_000 }] },
    }), {
        horasExtras: 2,
        horasAdeudadas: -0.5,
        montoHorasExtras: 12_000,
        montoHorasAdeudadas: -3_000,
    })
})

test('mantiene el total como horas extras cuando no hay ajuste', () => {
    assert.deepEqual(separarHorasExtrasYAdeudadas({
        horasExtras: 1,
        ajusteHorasExtras: 0,
        montoHorasExtras: 6_000,
    }), {
        horasExtras: 1,
        horasAdeudadas: 0,
        montoHorasExtras: 6_000,
        montoHorasAdeudadas: 0,
    })
})

test('usa la proporción de horas para liquidaciones históricas sin desglose diario', () => {
    assert.deepEqual(separarHorasExtrasYAdeudadas({
        horasExtras: 1,
        ajusteHorasExtras: 2,
        montoHorasExtras: 18_000,
    }), {
        horasExtras: 1,
        horasAdeudadas: 2,
        montoHorasExtras: 6_000,
        montoHorasAdeudadas: 12_000,
    })
})
