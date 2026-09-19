import test from 'node:test'
import assert from 'node:assert/strict'
import { filtrarFacturasGasto, paginaFacturasGasto, type FacturaGastoBuscable } from './listado-gastos'

const facturas: FacturaGastoBuscable[] = [
    {
        numeroFactura: 'A-001',
        proveedor: { nombre: 'Pinturería del Sur' },
        ubicacion: { nombre: 'Central' },
        gastos: [{ descripcion: 'Pintura látex', categoria: { nombre: 'Mantenimiento' } }],
    },
    {
        numeroFactura: 'B-002',
        proveedor: { nombre: 'Telecom' },
        ubicacion: { nombre: 'Villa Elisa' },
        gastos: [{ descripcion: 'Abono telefónico', categoria: { nombre: 'Servicios' } }],
    },
]

test('busca gastos por proveedor, factura, sede, descripción o categoría sin depender de tildes', () => {
    assert.deepEqual(filtrarFacturasGasto(facturas, 'pintureria'), [facturas[0]])
    assert.deepEqual(filtrarFacturasGasto(facturas, 'B-002'), [facturas[1]])
    assert.deepEqual(filtrarFacturasGasto(facturas, 'villa elisa'), [facturas[1]])
    assert.deepEqual(filtrarFacturasGasto(facturas, 'telefonico'), [facturas[1]])
    assert.deepEqual(filtrarFacturasGasto(facturas, 'mantenimiento'), [facturas[0]])
})

test('pagina la lista sin alterar su orden', () => {
    const valores = Array.from({ length: 23 }, (_, indice) => indice + 1)
    assert.deepEqual(paginaFacturasGasto(valores, 1, 10), valores.slice(0, 10))
    assert.deepEqual(paginaFacturasGasto(valores, 3, 10), valores.slice(20, 23))
})
