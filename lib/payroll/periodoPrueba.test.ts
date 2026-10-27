import assert from 'node:assert/strict'
import test from 'node:test'

import { antiguedadMesesCompletos, esPeriodoPruebaSeisMeses, requierePreavisoEnPeriodoPrueba } from './periodoPrueba'

test('considera período de prueba hasta el día anterior a cumplir seis meses', () => {
    assert.equal(esPeriodoPruebaSeisMeses('2026-06-15', '2026-12-14'), true)
    assert.equal(esPeriodoPruebaSeisMeses('2026-06-15', '2026-12-15'), false)
    assert.equal(antiguedadMesesCompletos('2026-06-15', '2026-11-14'), 4)
    assert.equal(antiguedadMesesCompletos('2026-06-15', '2026-11-15'), 5)
})

test('respeta días de fin de mes al sumar los seis meses', () => {
    assert.equal(esPeriodoPruebaSeisMeses('2026-08-31', '2027-02-27'), true)
    assert.equal(esPeriodoPruebaSeisMeses('2026-08-31', '2027-02-28'), false)
})

test('no aplica retroactivamente el plazo de seis meses a ingresos anteriores a su vigencia', () => {
    assert.equal(esPeriodoPruebaSeisMeses('2024-07-08', '2024-11-01'), false)
})

test('desde marzo de 2026 no exige preaviso durante el período de prueba', () => {
    assert.equal(requierePreavisoEnPeriodoPrueba('2026-03-05'), true)
    assert.equal(requierePreavisoEnPeriodoPrueba('2026-03-06'), false)
})
