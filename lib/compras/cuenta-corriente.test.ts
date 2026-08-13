import test from 'node:test'
import assert from 'node:assert/strict'
import { agruparMovimientosHistoricos, resumirCuentaCorriente } from './cuenta-corriente'

test('agrupa los renglones históricos de una misma factura sin duplicarla', () => {
    const facturas = agruparMovimientosHistoricos([
        { id: 'a', proveedorId: 'p1', proveedorNombre: 'Proveedor', numeroFactura: '100', fecha: new Date('2026-01-01'), costoTotal: 300, montoPagado: 50 },
        { id: 'b', proveedorId: 'p1', proveedorNombre: 'Proveedor', numeroFactura: '100', fecha: new Date('2026-01-01'), costoTotal: 700, montoPagado: 150 },
    ])
    assert.equal(facturas.length, 1)
    assert.equal(facturas[0].costoTotal, 1000)
    assert.equal(facturas[0].montoPagado, 200)
})

test('calcula el saldo real por proveedor y excluye facturas canceladas', () => {
    const resumen = resumirCuentaCorriente([
        { id: 'a', proveedorId: 'p1', proveedorNombre: 'Uno', numeroFactura: '1', fecha: new Date('2026-01-01'), costoTotal: 1000, montoPagado: 250, origen: 'compra' },
        { id: 'b', proveedorId: 'p1', proveedorNombre: 'Uno', numeroFactura: '2', fecha: new Date('2026-01-02'), costoTotal: 500, montoPagado: 500, origen: 'compra' },
        { id: 'c', proveedorId: 'p2', proveedorNombre: 'Dos', numeroFactura: '3', fecha: new Date('2026-01-03'), costoTotal: 200, montoPagado: 0, origen: 'historico' },
    ])
    assert.equal(resumen.cantidadFacturas, 2)
    assert.equal(resumen.totalPendiente, 950)
    assert.equal(resumen.proveedores.find(item => item.proveedorId === 'p1')?.saldoPendiente, 750)
})
