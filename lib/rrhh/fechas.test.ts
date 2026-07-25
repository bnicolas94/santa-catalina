import assert from 'node:assert/strict'
import test from 'node:test'

import {
    fechaClaveRRHH,
    instanteRRHH,
    rangoDiaRRHH,
    rangoDiasRRHH,
    sumarDiasRRHH,
    validarFechaCivilRRHH,
    ZONA_HORARIA_RRHH,
} from './fechas'

test('usa explícitamente la zona horaria de Buenos Aires', () => {
    assert.equal(ZONA_HORARIA_RRHH, 'America/Buenos_Aires')
})

test('mantiene el día argentino antes de las 03:00 UTC', () => {
    assert.equal(fechaClaveRRHH(new Date('2026-07-21T01:30:00.000Z')), '2026-07-20')
    assert.equal(fechaClaveRRHH(new Date('2026-07-21T03:30:00.000Z')), '2026-07-21')
})

test('convierte la medianoche argentina al instante UTC correcto', () => {
    assert.equal(instanteRRHH('2026-07-20').toISOString(), '2026-07-20T03:00:00.000Z')
    assert.equal(instanteRRHH('2026-07-20', '12:00:00').toISOString(), '2026-07-20T15:00:00.000Z')
})

test('construye rangos semiabiertos sin perder el último milisegundo', () => {
    const dia = rangoDiaRRHH('2026-07-20')
    const semana = rangoDiasRRHH('2026-07-20', '2026-07-26')

    assert.equal(dia.gte.toISOString(), '2026-07-20T03:00:00.000Z')
    assert.equal(dia.lt.toISOString(), '2026-07-21T03:00:00.000Z')
    assert.equal(semana.lt.toISOString(), '2026-07-27T03:00:00.000Z')
})

test('suma días civiles correctamente entre meses y años', () => {
    assert.equal(sumarDiasRRHH('2026-07-31', 1), '2026-08-01')
    assert.equal(sumarDiasRRHH('2026-12-31', 1), '2027-01-01')
})

test('rechaza fechas civiles inexistentes', () => {
    assert.throws(() => validarFechaCivilRRHH('2026-02-30'), /inválida/)
    assert.throws(() => validarFechaCivilRRHH('20-07-2026'), /inválida/)
})
