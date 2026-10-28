import assert from 'node:assert/strict'
import test from 'node:test'

import {
    calcularVacacionesNoGozadasProporcionales,
    diasVacacionesAnualesPorAntiguedad,
} from './vacacionesNoGozadas'

test('respeta los límites exactos de la escala anual de vacaciones', () => {
    assert.equal(diasVacacionesAnualesPorAntiguedad(5), 14)
    assert.equal(diasVacacionesAnualesPorAntiguedad(6), 21)
    assert.equal(diasVacacionesAnualesPorAntiguedad(10), 21)
    assert.equal(diasVacacionesAnualesPorAntiguedad(11), 28)
    assert.equal(diasVacacionesAnualesPorAntiguedad(20), 28)
    assert.equal(diasVacacionesAnualesPorAntiguedad(21), 35)
})

test('no computa días anteriores al ingreso en las vacaciones de la liquidación final', () => {
    const calculo = calcularVacacionesNoGozadasProporcionales({
        fechaIngreso: '2026-07-28',
        fechaEgreso: '2026-10-28',
        diasVacacionesAnuales: 14,
        sueldoMensual: 963000,
    })

    assert.equal(calculo.diasRelacionEnAnio, 93)
    assert.equal(calculo.diasBaseAnual, 365)
    assert.equal(Number(calculo.dias.toFixed(2)), 3.57)
    assert.equal(Number(calculo.monto.toFixed(2)), 137405.59)
})

test('conserva el cálculo desde enero cuando la relación comenzó en un año anterior', () => {
    const calculo = calcularVacacionesNoGozadasProporcionales({
        fechaIngreso: '2025-06-01',
        fechaEgreso: '2026-10-28',
        diasVacacionesAnuales: 14,
        sueldoMensual: 963000,
    })

    assert.equal(calculo.diasRelacionEnAnio, 301)
    assert.equal(Number(calculo.dias.toFixed(2)), 11.55)
})

test('usa 366 días como base en un año bisiesto', () => {
    const calculo = calcularVacacionesNoGozadasProporcionales({
        fechaIngreso: '2028-01-01',
        fechaEgreso: '2028-12-31',
        diasVacacionesAnuales: 14,
        sueldoMensual: 1000000,
    })

    assert.equal(calculo.diasBaseAnual, 366)
    assert.equal(calculo.diasRelacionEnAnio, 366)
    assert.equal(calculo.dias, 14)
})
