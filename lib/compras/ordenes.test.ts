import assert from 'node:assert/strict'
import test from 'node:test'
import { leerOrdenCompraInput } from './ordenes'

test('valida y normaliza una orden con cantidades decimales', () => {
    assert.deepEqual(leerOrdenCompraInput({ proveedorId: 'p1', ubicacionId: '', observaciones: '  urgente ', detalles: [{ insumoId: 'i1', cantidad: '2.5', observaciones: '' }] }), {
        proveedorId: 'p1', ubicacionId: null, observaciones: 'urgente', detalles: [{ insumoId: 'i1', cantidad: 2.5, observaciones: null }],
    })
})

test('rechaza órdenes vacías, duplicadas o cantidades inválidas', () => {
    const base = { proveedorId: 'p1', detalles: [{ insumoId: 'i1', cantidad: 1 }] }
    assert.throws(() => leerOrdenCompraInput({ ...base, detalles: [] }))
    assert.throws(() => leerOrdenCompraInput({ ...base, detalles: [base.detalles[0], base.detalles[0]] }))
    assert.throws(() => leerOrdenCompraInput({ ...base, detalles: [{ insumoId: 'i1', cantidad: 'abc' }] }))
    assert.throws(() => leerOrdenCompraInput({ ...base, detalles: [{ insumoId: 'i1', cantidad: 0 }] }))
})
