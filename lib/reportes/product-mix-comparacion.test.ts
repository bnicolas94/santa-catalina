import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compararProductMix, diasRangoIso, rangoAnteriorIgualDuracion } from './product-mix-comparacion'
import type { calcularProductMix } from './product-mix'

type Mix = ReturnType<typeof calcularProductMix>

test('propone un período anterior de igual cantidad de días sin desplazar Fecha Entrega', () => {
    assert.equal(diasRangoIso('2026-11-13', '2026-11-20'), 8)
    assert.deepEqual(rangoAnteriorIgualDuracion('2026-11-13', '2026-11-20'),
        { desde: '2026-11-05', hasta: '2026-11-12' })
})

test('compara por clave de paquete e ID de insumo, incluidos los que sólo aparecen en un período', () => {
    const principal: Mix = { paquetes: 3, filasIncompletas: 0, filas: [{ clave: '8:elegidos', nombre: 'Elegidos',
        presentacion: 8, paquetes: 3, ingresoAtribuido: 300,
        insumos: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .3, costoIdentificado: 30 }], faltantes: [] }],
        totales: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .3, costoIdentificado: 30 }] }
    const referencia: Mix = { paquetes: 3, filasIncompletas: 0, filas: [
        { clave: '8:elegidos', nombre: 'Elegidos', presentacion: 8, paquetes: 2, ingresoAtribuido: 200,
            insumos: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .2, costoIdentificado: 20 }], faltantes: [] },
        { clave: '16:elegidos', nombre: 'Elegidos', presentacion: 16, paquetes: 1, ingresoAtribuido: 150,
            insumos: [{ id: 'caja', nombre: 'Caja', unidad: 'u', cantidad: 1, costoIdentificado: 5 }], faltantes: [] },
    ], totales: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .2, costoIdentificado: 20 },
        { id: 'caja', nombre: 'Caja', unidad: 'u', cantidad: 1, costoIdentificado: 5 }] }
    const resultado = compararProductMix(principal, referencia)
    assert.equal(resultado.diferencia.paquetes, 0)
    assert.equal(resultado.diferencia.costoIdentificado, 5)
    assert.equal(resultado.filas.find(fila => fila.presentacion === 8)?.diferencia.paquetes, 1)
    assert.equal(resultado.filas.find(fila => fila.presentacion === 16)?.diferencia.paquetes, -1)
    assert.equal(resultado.filas.find(fila => fila.presentacion === 16)?.diferencia.costoIdentificado, -5)
    assert.equal(resultado.insumos.find(item => item.id === 'mayo')?.diferencia.cantidad, .1)
    assert.equal(resultado.insumos.find(item => item.id === 'caja')?.diferencia.cantidad, -1)
})

test('muestra cantidades identificables y omite la diferencia de costo si faltan fichas o precios', () => {
    const principal: Mix = { paquetes: 1, filasIncompletas: 1, filas: [{ clave: '8:elegidos', nombre: 'Elegidos',
        presentacion: 8, paquetes: 1, ingresoAtribuido: 100,
        insumos: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .1, costoIdentificado: null }],
        faltantes: ['Sin precio: Mayonesa'] }],
        totales: [{ id: 'mayo', nombre: 'Mayonesa', unidad: 'kg', cantidad: .1, costoIdentificado: null }] }
    const referencia: Mix = { paquetes: 0, filasIncompletas: 0, filas: [], totales: [] }
    const resultado = compararProductMix(principal, referencia)
    assert.equal(resultado.filas[0].diferencia.paquetes, 1)
    assert.equal(resultado.insumos[0].diferencia.cantidad, .1)
    assert.equal(resultado.insumos[0].diferencia.costoIdentificado, null)
    assert.equal(resultado.filas[0].diferencia.costoIdentificado, null)
    assert.equal(resultado.diferencia.costoIdentificado, null)
})
