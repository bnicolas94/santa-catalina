import assert from 'node:assert/strict'
import test from 'node:test'
import { decidirEstadoStock, interpretarPaquetes, parsearCsvSheetStock } from './google-sheets-stock'

test('interpreta paquetes simples y combinados sin confundir unidades con paquetes', () => {
    const filas = parsearCsvSheetStock('ID,Producto,Cantidad,Ubicación,Estado\n1,"1x 48 Jamón y Queso + 1x 48 Surtidos Clásicos",96,Local 1,Entregado')
    assert.equal(filas.length, 1)
    assert.deepEqual(interpretarPaquetes(filas[0]).lineas, [
        { codigo: 'JQ', presentacion: 48, paquetes: 1 },
        { codigo: 'CLA', presentacion: 48, paquetes: 1 },
    ])
    assert.deepEqual(interpretarPaquetes({ productoTexto: '2x 24 Jamón y Queso', cantidadTexto: '48' }).lineas,
        [{ codigo: 'JQ', presentacion: 24, paquetes: 2 }])
})

test('deja en revisión sabores personalizados y cantidades que no coinciden', () => {
    assert.equal(interpretarPaquetes({ productoTexto: 'Turno: Siesta\n=== SABORES PERSONALIZADOS ===', cantidadTexto: '24' }).lineas, null)
    assert.equal(interpretarPaquetes({ productoTexto: '48 Jamón y Queso', cantidadTexto: '24' }).lineas, null)
    assert.equal(interpretarPaquetes({ productoTexto: '48 Producto desconocido', cantidadTexto: '48' }).lineas, null)
})

test('deduplica copias idénticas de un ID y revisa las contradictorias', () => {
    const iguales = parsearCsvSheetStock('ID,Producto,Cantidad,Ubicación,Estado\n1,48 Jamón y Queso,48,Local 1,Entregado\n1,48 Jamón y Queso,48,Local 1,Entregado')
    assert.equal(iguales.length, 1)
    assert.equal(iguales[0].conflictoId, false)
    assert.equal(interpretarPaquetes(iguales[0]).lineas?.length, 1)
    const distintas = parsearCsvSheetStock('ID,Producto,Cantidad,Ubicación,Estado\n1,48 Jamón y Queso,48,Local 1,Entregado\n1,24 Jamón y Queso,24,Local 1,Entregado')
    assert.equal(distintas.length, 1)
    assert.equal(distintas[0].conflictoId, true)
    assert.equal(interpretarPaquetes(distintas[0]).lineas, null)
})

test('no vuelve a descontar filas registradas ni históricas', () => {
    const fila = parsearCsvSheetStock('ID,Producto,Cantidad,Ubicación,Estado\n1,48 Jamón y Queso,48,Local 1,Entregado')[0]
    assert.equal(decidirEstadoStock(fila, { estadoProcesamiento: 'DESCONTADO', estadoFuente: 'entregado', huellaStock: fila.huellaStock }), 'SIN_CAMBIOS')
    assert.equal(decidirEstadoStock(fila, { estadoProcesamiento: 'ANTERIOR', estadoFuente: 'entregado', huellaStock: fila.huellaStock }), 'ANTERIOR')
    assert.equal(decidirEstadoStock({ ...fila, cantidadTexto: '24', huellaStock: 'otra' }, { estadoProcesamiento: 'DESCONTADO', estadoFuente: 'entregado', huellaStock: fila.huellaStock }), 'REQUIERE_REVISION')
    assert.equal(decidirEstadoStock(fila, { estadoProcesamiento: 'REQUIERE_REVISION', estadoFuente: 'entregado', huellaStock: fila.huellaStock }), 'SIN_CAMBIOS')
})
