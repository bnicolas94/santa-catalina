import assert from 'node:assert/strict'
import test from 'node:test'

import {
    calcularDiferenciaDeposito,
    exigirSaldoParaDeposito,
    esDeclaracionDepositoConfigurada,
    planificarValidacionDeposito,
    requiereAutorizacionDeposito,
    validarMontoDeposito,
    validarObservacionesDiferencia,
} from './depositos'

test('calcula faltantes y sobrantes con precisión monetaria', () => {
    assert.equal(calcularDiferenciaDeposito(1_110_000, 1_002_000), -108_000)
    assert.equal(calcularDiferenciaDeposito(100.10, 100.20), 0.10)
})

test('el ejemplo real concilia la caja de origen y transfiere sólo lo contado', () => {
    const declarado = 1_110_000
    const real = 1_002_000
    const ajuste = calcularDiferenciaDeposito(declarado, real)

    assert.equal(ajuste, -108_000)
    assert.equal(declarado + ajuste - real, 0)
})

test('acepta monto real cero pero no un monto declarado cero', () => {
    assert.equal(validarMontoDeposito(0, true), 0)
    assert.throws(() => validarMontoDeposito(0), /mayor a cero/)
})

test('exige observación cuando existe una diferencia', () => {
    assert.equal(validarObservacionesDiferencia(0, ''), null)
    assert.equal(validarObservacionesDiferencia(-108_000, 'Faltante al contar'), 'Faltante al contar')
    assert.throws(() => validarObservacionesDiferencia(-1, ''), /observación/)
})

test('un depósito sólo puede usar el saldo disponible salvo autorización administrativa', () => {
    assert.equal(requiereAutorizacionDeposito(500, 500), false)
    assert.equal(requiereAutorizacionDeposito(600, 500), true)
    assert.doesNotThrow(() => exigirSaldoParaDeposito(500, 500, false))
    assert.doesNotThrow(() => exigirSaldoParaDeposito(600, 500, true))
    assert.throws(() => exigirSaldoParaDeposito(600, 500, false), /autorización de un administrador/)
})

test('la validación nueva consume el saldo reservado y la histórica conserva su conciliación', () => {
    assert.deepEqual(planificarValidacionDeposito(500, 450, 'egreso'), {
        diferencia: -50,
        usaSaldoExistente: true,
        tipoAjuste: 'ingreso',
        transferirDesdeOrigenAlValidar: false,
    })
    assert.deepEqual(planificarValidacionDeposito(500, 450, 'ingreso'), {
        diferencia: -50,
        usaSaldoExistente: false,
        tipoAjuste: 'egreso',
        transferirDesdeOrigenAlValidar: true,
    })
})

test('reconoce el formulario antiguo como una declaración de depósito', () => {
    const config = {
        habilitarDeposito: true,
        conceptoDeposito: 'Depósito Diario Local',
        cajaDepositoId: 'local',
    }

    assert.equal(esDeclaracionDepositoConfigurada({
        tipo: 'ingreso',
        concepto: 'Depósito Diario Local',
        medioPago: 'efectivo',
        cajaOrigen: 'local',
    }, config), true)
    assert.equal(esDeclaracionDepositoConfigurada({
        tipo: 'egreso',
        concepto: 'Depósito Diario Local',
        medioPago: 'efectivo',
        cajaOrigen: 'local',
    }, config), false)
})
