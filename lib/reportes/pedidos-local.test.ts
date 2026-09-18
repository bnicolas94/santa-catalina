import assert from 'node:assert/strict'
import test from 'node:test'
import { parsearCsvSheetCaja } from '@/lib/google-sheets-caja'
import { calcularPedidosLocal, validarPeriodoPedidosLocal } from './pedidos-local'

const filtros = { desde: '2026-09-17', hasta: '2026-09-17' }
function filas(texto: string, hoja = 'Pedidos_comunes') {
    return parsearCsvSheetCaja(`ID,Fecha/Hora,Precio,Pago,Ubicación,Estado\n${texto}`).map(f => ({ ...f, hoja }))
}

test('cuenta IDs entregados por hora argentina e incluye el último minuto del día', () => {
    const reporte = calcularPedidosLocal(filas('1,17/09/2026 00:00,100,Efectivo,Local 1,Entregado\n2,17/09/2026 23:59,300,Transferencia,Local 1,Entregado\n3,18/09/2026 00:00,500,Efectivo,Local 1,Entregado\n4,17/09/2026 12:00,100,Efectivo,Local 1,Pendiente'), filtros)
    assert.equal(reporte.tickets, 2)
    assert.equal(reporte.importe, 400)
    assert.equal(reporte.ticketPromedio, 200)
    assert.equal(reporte.porHora[23].tickets, 1)
    assert.deepEqual(reporte.horasPico, [0, 23])
    assert.equal(reporte.porHora.reduce((s, h) => s + h.tickets, 0), reporte.tickets)
    assert.equal(reporte.porHora.reduce((s, h) => s + h.importe, 0), reporte.importe)
})

test('deduplica por hoja e ID y excluye IDs contradictorios', () => {
    const a = filas('1,17/09/2026 12:00,100,Efectivo,Local 1,Entregado')
    const conflicto = filas('2,17/09/2026 13:00,100,Efectivo,Local 1,Entregado\n2,17/09/2026 13:00,200,Efectivo,Local 1,Entregado')
    const reporte = calcularPedidosLocal([...a, ...a, ...a.map(f => ({ ...f, hoja: 'Pedidos_online' })), ...conflicto], filtros)
    assert.equal(reporte.tickets, 2)
    assert.equal(reporte.calidad.duplicados, 1)
    assert.equal(reporte.calidad.idsEnConflicto, 1)
})

test('no inventa horas ni importes y rechaza fechas imposibles', () => {
    const reporte = calcularPedidosLocal(filas('1,17/09/2026,100,Efectivo,Local 1,Entregado\n2,31/02/2026 12:00,100,Efectivo,Local 1,Entregado\n3,17/09/2026 12:00,,Efectivo,Local 1,Entregado'), filtros)
    assert.equal(reporte.tickets, 1)
    assert.equal(reporte.calidad.sinFechaHora, 2)
    assert.equal(reporte.calidad.sinImporte, 1)
    assert.equal(reporte.ticketPromedio, null)
})

test('filtra origen, ubicación normalizada y todos los estados sin restringir el medio de pago', () => {
    const base = filas('1,17/09/2026 12:00,100,Tarjeta,Villa Elisa,Pendiente\n2,17/09/2026 12:00,300,Efectivo,Local 1,Entregado')
    const reporte = calcularPedidosLocal([...base, ...base.map(f => ({ ...f, hoja: 'Pedidos_online' }))], { ...filtros, hoja: 'Pedidos_comunes', ubicacion: ' VILLA ELISA ', estado: 'todos' })
    assert.equal(reporte.tickets, 1)
    assert.equal(reporte.importe, 100)
})

test('valida fechas, orden y máximo del período y devuelve las 24 horas vacías', () => {
    assert.throws(() => validarPeriodoPedidosLocal('2026-02-30', '2026-03-01'))
    assert.throws(() => validarPeriodoPedidosLocal('2026-09-18', '2026-09-17'))
    assert.throws(() => validarPeriodoPedidosLocal('2025-01-01', '2026-09-17'))
    const reporte = calcularPedidosLocal([], filtros)
    assert.equal(reporte.porHora.length, 24)
    assert.equal(reporte.ticketPromedio, null)
    assert.deepEqual(reporte.horasPico, [])
})
