import assert from 'node:assert/strict'
import test from 'node:test'
import { validarMotivoAnulacionCaja } from './auditoria'

test('la anulación de Caja exige un motivo concreto', () => {
    assert.throws(() => validarMotivoAnulacionCaja(''), /al menos 5 caracteres/)
    assert.throws(() => validarMotivoAnulacionCaja('err'), /al menos 5 caracteres/)
})

test('normaliza el motivo antes de guardarlo', () => {
    assert.equal(validarMotivoAnulacionCaja('  Diferencia de arqueo  '), 'Diferencia de arqueo')
})

test('rechaza motivos excesivamente largos', () => {
    assert.throws(() => validarMotivoAnulacionCaja('x'.repeat(501)), /500 caracteres/)
})
