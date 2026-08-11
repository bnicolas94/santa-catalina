import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizarUnidadParaFormulario } from './unidades'

test('normaliza unidades historicas al valor reconocido por el selector', () => {
    assert.equal(normalizarUnidadParaFormulario('unidades'), 'u')
    assert.equal(normalizarUnidadParaFormulario('Kilogramos'), 'kg')
    assert.equal(normalizarUnidadParaFormulario('L'), 'lt')
})

test('conserva unidades canonicas', () => {
    assert.equal(normalizarUnidadParaFormulario('kg'), 'kg')
    assert.equal(normalizarUnidadParaFormulario('g'), 'g')
})
