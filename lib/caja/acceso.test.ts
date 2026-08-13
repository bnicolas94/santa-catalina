import assert from 'node:assert/strict'
import test from 'node:test'
import { puedeTransferirEntreCajas } from './acceso'

test('LOCAL sólo transfiere cuando ambas cajas pertenecen al local', () => {
    assert.equal(puedeTransferirEntreCajas('LOCAL', 'local', 'caja_chica_local'), true)
    assert.equal(puedeTransferirEntreCajas('LOCAL', 'local', 'caja_madre'), false)
    assert.equal(puedeTransferirEntreCajas('LOCAL', 'caja_madre', 'local'), false)
})

test('FABRICA no puede transferir hacia cajas del local', () => {
    assert.equal(puedeTransferirEntreCajas('FABRICA', 'caja_madre', 'caja_chica'), true)
    assert.equal(puedeTransferirEntreCajas('FABRICA', 'caja_chica', 'local'), false)
})
