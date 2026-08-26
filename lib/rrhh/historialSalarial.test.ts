import assert from 'node:assert/strict'
import test from 'node:test'

import { cambioSalarialRelevante, configuracionSalarialEfectiva } from './historialSalarial'

test('respeta la misma prioridad salarial que la liquidación semanal', () => {
    assert.deepEqual(configuracionSalarialEfectiva({
        jornal: 120_000,
        sueldoBaseMensual: 900_000,
        cicloPago: 'SEMANAL',
        valorHoraExtra: 8_000,
        rolRel: { jornal: 100_000, cicloPago: 'SEMANAL', valorHoraExtra: 7_000 },
    }), {
        monto: 120_000,
        cicloPago: 'SEMANAL',
        valorHoraExtra: 8_000,
        fuente: 'EMPLEADO',
    })
})

test('registra el valor heredado del tipo cuando no hay jornal individual', () => {
    assert.deepEqual(configuracionSalarialEfectiva({
        jornal: 0,
        sueldoBaseMensual: 0,
        cicloPago: 'MENSUAL',
        valorHoraExtra: 0,
        rolRel: { jornal: 95_000, cicloPago: 'SEMANAL', valorHoraExtra: 6_500 },
    }), {
        monto: 95_000,
        cicloPago: 'SEMANAL',
        valorHoraExtra: 6_500,
        fuente: 'ROL',
    })
})

test('detecta cambios de monto, ciclo, hora extra o fuente', () => {
    const base = { monto: 100_000, cicloPago: 'SEMANAL', valorHoraExtra: 7_000, fuente: 'ROL' as const }
    assert.equal(cambioSalarialRelevante(base, { ...base }), false)
    assert.equal(cambioSalarialRelevante(base, { ...base, monto: 110_000 }), true)
    assert.equal(cambioSalarialRelevante(base, { ...base, valorHoraExtra: 8_000 }), true)
    assert.equal(cambioSalarialRelevante(base, { ...base, fuente: 'EMPLEADO' }), true)
})
