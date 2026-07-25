import assert from 'node:assert/strict'
import test from 'node:test'

import { reconstruirLiquidacionCalculada, validarMontoAdicional } from './validacionLiquidacion'

const desglose = {
    desglosePorDia: [{
        fecha: '2026-07-20',
        horasTrabajadas: 8,
        horasExtras: 0,
        jornalBase: 10_000,
        valorDiaBase: 8_889,
        multiplicadorJornal: 8 / 9,
        valorExtra: 0,
        valorFeriado: 0,
    }],
}

test('reconstruye los totales desde el desglose y no desde totales recibidos', () => {
    const resultado = reconstruirLiquidacionCalculada(desglose, 10_000, 2_000)
    assert.equal(resultado.sueldoBase, 8_889)
    assert.equal(resultado.horasNormales, 8)
    assert.equal(resultado.diasTrabajados, 1)
})

test('rechaza un jornal diario alterado por el cliente', () => {
    assert.throws(() => reconstruirLiquidacionCalculada({
        desglosePorDia: [{ ...desglose.desglosePorDia[0], jornalBase: 50_000 }],
    }, 10_000, 2_000), /no coincide/)
})

test('rechaza importes base o de extras inconsistentes', () => {
    assert.throws(() => reconstruirLiquidacionCalculada({
        desglosePorDia: [{ ...desglose.desglosePorDia[0], valorDiaBase: 20_000 }],
    }, 10_000, 2_000), /base/)
    assert.throws(() => reconstruirLiquidacionCalculada({
        desglosePorDia: [{ ...desglose.desglosePorDia[0], horasExtras: 1, valorExtra: 9_000 }],
    }, 10_000, 2_000), /horas extras/)
})

test('rechaza NaN, infinitos, multiplicadores fuera de rango y ajustes excesivos', () => {
    assert.throws(() => reconstruirLiquidacionCalculada({
        desglosePorDia: [{ ...desglose.desglosePorDia[0], valorDiaBase: Number.NaN }],
    }, 10_000, 2_000), /número válido/)
    assert.throws(() => reconstruirLiquidacionCalculada({
        desglosePorDia: [{ ...desglose.desglosePorDia[0], multiplicadorJornal: 2 }],
    }, 10_000, 2_000), /no coincide/)
    assert.throws(() => reconstruirLiquidacionCalculada({ ...desglose, ajusteHorasExtras: 200 }, 10_000, 2_000), /límite/)
})

test('permite adicionales positivos o descuentos negativos finitos dentro del límite', () => {
    assert.equal(validarMontoAdicional(5_000), 5_000)
    assert.equal(validarMontoAdicional(-2_000), -2_000)
    assert.throws(() => validarMontoAdicional(Number.POSITIVE_INFINITY), /número válido/)
})
