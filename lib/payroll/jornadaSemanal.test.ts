import assert from 'node:assert/strict'
import test from 'node:test'

import { horasJornadaParaFecha } from './jornadaSemanal'

test('mantiene la jornada habitual de lunes a viernes', () => {
    assert.equal(horasJornadaParaFecha('2026-09-04', 9, 8), 9)
})

test('permite una jornada especial para el sábado', () => {
    assert.equal(horasJornadaParaFecha('2026-09-05', 9, 8), 8)
    assert.equal(horasJornadaParaFecha('2026-09-05', 9, null), 9)
})

test('los domingos tienen una jornada general de cuatro horas', () => {
    assert.equal(horasJornadaParaFecha('2026-09-06', 9, 8), 4)
})
