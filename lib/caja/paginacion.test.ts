import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizarPaginacionCaja } from './paginacion'

test('pagina el historial de Caja en grupos de diez', () => {
    assert.deepEqual(normalizarPaginacionCaja(2, 25), {
        pagina: 2,
        porPagina: 10,
        total: 25,
        totalPaginas: 3,
        skip: 10,
    })
})

test('corrige páginas inválidas o posteriores al último movimiento', () => {
    assert.equal(normalizarPaginacionCaja(99, 11).pagina, 2)
    assert.equal(normalizarPaginacionCaja(0, 11).pagina, 1)
    assert.equal(normalizarPaginacionCaja('valor inválido', 0).totalPaginas, 1)
})
