import assert from 'node:assert/strict'
import test from 'node:test'

import { construirConfigDepositos } from './configDepositos'

test('vincula cada Caja Chica con la Caja Fuerte de su misma sede', () => {
    const config = construirConfigDepositos([
        { tipo: 'chica_villa', nombre: 'Caja Chica Villa Elisa', ubicacionId: 'villa', recibeDepositos: false, conceptoDeposito: 'Depósito diario' },
        { tipo: 'fuerte_villa', nombre: 'Caja Fuerte Villa Elisa', ubicacionId: 'villa', recibeDepositos: true, conceptoDeposito: 'Sobre Villa Elisa' },
        { tipo: 'chica_gutierrez', nombre: 'Caja Chica Local', ubicacionId: 'gutierrez', recibeDepositos: false, conceptoDeposito: 'Depósito diario' },
        { tipo: 'fuerte_gutierrez', nombre: 'Caja Fuerte Local', ubicacionId: 'gutierrez', recibeDepositos: true, conceptoDeposito: 'Sobre Gutiérrez' },
        { tipo: 'mercado_pago', nombre: 'Mercado Pago', ubicacionId: null, recibeDepositos: false, conceptoDeposito: 'Depósito diario' },
    ])

    assert.deepEqual(config.villa, {
        cajaOrigenId: 'chica_villa',
        cajaRecepcionId: 'fuerte_villa',
        conceptoDeposito: 'Sobre Villa Elisa',
        habilitarDeposito: true,
    })
    assert.deepEqual(config.gutierrez, {
        cajaOrigenId: 'chica_gutierrez',
        cajaRecepcionId: 'fuerte_gutierrez',
        conceptoDeposito: 'Sobre Gutiérrez',
        habilitarDeposito: true,
    })
    assert.equal(Object.keys(config).length, 2)
})
