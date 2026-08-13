import assert from 'node:assert/strict'
import test from 'node:test'
import { consolidarDetallesPedido } from './stockPedido'

test('consolida detalles repetidos de una presentación para descontar una sola vez', () => {
    const resultado = consolidarDetallesPedido([
        { cantidad: 2, presentacionId: 'pres-1', presentacion: { productoId: 'prod-1' } },
        { cantidad: 3, presentacionId: 'pres-1', presentacion: { productoId: 'prod-1' } },
        { cantidad: 1, presentacionId: 'pres-2', presentacion: { productoId: 'prod-2' } },
    ])

    assert.deepEqual(Array.from(resultado.entries()), [
        ['pres-1', { productoId: 'prod-1', cantidad: 5 }],
        ['pres-2', { productoId: 'prod-2', cantidad: 1 }],
    ])
})
