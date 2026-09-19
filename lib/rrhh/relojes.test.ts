import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizarCodigoReloj, origenRelojDesdeFuente } from './relojes'

test('normaliza el código dentro de cada reloj sin mezclar el origen', () => {
    assert.equal(normalizarCodigoReloj('0037'), '37')
    assert.equal(origenRelojDesdeFuente('fabrica_txt'), 'FABRICA')
    assert.equal(origenRelojDesdeFuente('local_xls'), 'GUTIERREZ')
    assert.equal(origenRelojDesdeFuente('villa_elisa_xls'), 'VILLA_ELISA')
})

test('rechaza identificadores de reloj no numéricos', () => {
    assert.throws(() => normalizarCodigoReloj('VE-2'), /sólo números/)
})
