import assert from 'node:assert/strict'
import test from 'node:test'

import { construirItemsStockAdmin, esVentaDelivery } from './stock-resumen-admin'

test('separa delivery de las ventas atendidas en el local', () => {
    assert.equal(esVentaDelivery('Delivery'), true)
    assert.equal(esVentaDelivery('Retiro'), false)
    assert.equal(esVentaDelivery('Entrega'), false)
})
test('cruza stock, producción y ventas por sede y presentación', () => {
    const dimension = {
        productoId: 'jq', presentacionId: 'jq48', codigoInterno: 'JQ', producto: 'Jamón y Queso',
        presentacion: 48, ubicacionId: 'central', ubicacion: 'Central', ubicacionTipo: 'FABRICA',
    }
    const [item] = construirItemsStockAdmin(
        [dimension],
        [{ ...dimension, cantidad: 20 }],
        [{ ...dimension, cantidad: 14 }],
        [{ ...dimension, cantidad: 3, modalidad: 'Retiro' }, { ...dimension, cantidad: 4, modalidad: 'Delivery' }],
    )
    assert.deepEqual(item, {
        ...dimension,
        disponible: 20,
        producido: 14,
        vendidoLocal: 3,
        vendidoDelivery: 4,
        vendidoTotal: 7,
        balanceDia: 7,
    })
})
