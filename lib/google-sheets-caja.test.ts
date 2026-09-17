import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluarFilaSheet, normalizarImporte, normalizarTexto, parsearCsvSheetCaja, parsearFechaArgentina, rangoDiaArgentinaSheet } from './google-sheets-caja'

test('lee las columnas financieras aunque Producto tenga saltos de línea', () => {
    const csv = 'ID,Fecha/Hora,Nombre,Apellido,Teléfono,Dirección,Producto,Cantidad,Precio,Pago,Modalidad,Ubicación,Estado\n' +
        '22180,16/09/2026 15:07,Prueba,,,,"Jamón\ny queso",24,"$ 16.000",Transferencia,Retiro,Villa Elisa,Entregado'
    const [fila] = parsearCsvSheetCaja(csv)
    assert.equal(fila.externalId, '22180')
    assert.equal(fila.precio, 16000)
    assert.equal(fila.pagoClave, 'transferencia')
    assert.equal(fila.ubicacionClave, 'villa elisa')
    assert.equal(fila.estadoClave, 'entregado')
    assert.equal(fila.fecha?.toISOString(), '2026-09-16T18:07:00.000Z')
})

test('normaliza textos e importes argentinos', () => {
    assert.equal(normalizarTexto('  Villa   Elisa '), 'villa elisa')
    assert.equal(normalizarImporte('1.234,50'), 1234.5)
    assert.equal(normalizarImporte('16000'), 16000)
    assert.equal(parsearFechaArgentina('fecha inválida'), null)
})

test('el filtro por fecha cubre el día civil completo de Argentina', () => {
    const rango = rangoDiaArgentinaSheet('2026-09-17')
    assert.equal(rango.gte.toISOString(), '2026-09-17T03:00:00.000Z')
    assert.equal(rango.lt.toISOString(), '2026-09-18T03:00:00.000Z')
    assert.throws(() => rangoDiaArgentinaSheet('2026-02-31'), /fecha válida/)
})

test('sólo registra pedidos entregados desde la activación', () => {
    const base = parsearCsvSheetCaja('ID,Fecha/Hora,Precio,Pago,Ubicación,Estado\n1,16/09/2026 15:07,16000,Efectivo,Local 1,Pendiente')[0]
    const inicio = new Date('2026-09-16T17:00:00.000Z')
    assert.equal(evaluarFilaSheet({ fila: base, fechaInicio: inicio }).accion, 'OBSERVAR')
    const entregada = { ...base, estado: 'Entregado', estadoClave: 'entregado' }
    assert.equal(evaluarFilaSheet({ fila: entregada, fechaInicio: inicio }).accion, 'REGISTRAR')
    assert.equal(evaluarFilaSheet({ fila: { ...entregada, fecha: new Date('2026-09-15T15:00:00Z') }, fechaInicio: inicio }).accion, 'OBSERVAR')
})

test('un movimiento ya creado no se duplica y los cambios quedan para revisión', () => {
    const fila = parsearCsvSheetCaja('ID,Fecha/Hora,Precio,Pago,Ubicación,Estado\n1,16/09/2026 15:07,16000,Transferencia,Villa Elisa,Entregado')[0]
    const existente = { estadoFuente: 'entregado', huellaFinanciera: fila.huellaFinanciera, movimientoCajaId: 'mov-1', estadoProcesamiento: 'REGISTRADO' }
    assert.equal(evaluarFilaSheet({ fila, fechaInicio: new Date(0), existente }).accion, 'NINGUNA')
    assert.equal(evaluarFilaSheet({ fila: { ...fila, precio: 17000, huellaFinanciera: 'otra' }, fechaInicio: new Date(0), existente }).accion, 'REVISION')
    assert.equal(evaluarFilaSheet({ fila: { ...fila, estado: 'Pendiente', estadoClave: 'pendiente' }, fechaInicio: new Date(0), existente }).accion, 'REVISION')
})
