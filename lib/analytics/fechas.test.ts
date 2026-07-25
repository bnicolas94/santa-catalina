import assert from 'node:assert/strict'
import test from 'node:test'

import { periodoAnalyticsValido, periodoMesActual, periodoSemanaActual } from './fechas'

test('valida el orden y la existencia de las fechas de Analíticas', () => {
    assert.equal(periodoAnalyticsValido('2026-07-01', '2026-07-31'), true)
    assert.equal(periodoAnalyticsValido('2026-07-31', '2026-07-01'), false)
    assert.equal(periodoAnalyticsValido('2026-02-30', '2026-03-01'), false)
})

test('calcula el mes civil completo sin depender de UTC', () => {
    assert.deepEqual(periodoMesActual(new Date(2024, 1, 15, 23, 30)), {
        desde: '2024-02-01',
        hasta: '2024-02-29',
    })
})

test('calcula la semana de lunes a domingo, incluso desde un domingo', () => {
    assert.deepEqual(periodoSemanaActual(new Date(2026, 6, 26, 12)), {
        desde: '2026-07-20',
        hasta: '2026-07-26',
    })
})
