import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularReporteProduccion, rangoProduccionArgentina, type LoteReporteProduccion } from './produccion'

const producto = { id: 'jq', nombre: 'Jamón y Queso', codigoInterno: 'JQ', planchasPorPaquete: 6,
    presentaciones: [{ id: 'p16', cantidad: 16 }, { id: 'p48', cantidad: 48 }] }
const lote = (id: string, dia: string, paquetes: number, rechazados = 0, estado = 'en_camara', base = 'p16'): LoteReporteProduccion => ({
    id, fechaProduccion: new Date(`${dia}T00:00:00Z`), estado, unidadesProducidas: paquetes,
    unidadesRechazadas: rechazados, distribucion: [{ presentacionId: base, cantidad: paquetes - rechazados }],
    movimientosProducto: [], producto,
})

test('interpreta el filtro local argentino sin perder el primer día almacenado a medianoche UTC', () => {
    const r = rangoProduccionArgentina('2026-11-01T03:00:00Z', '2026-11-30T02:59:59Z')
    assert.equal(r.desde, '2026-11-01')
    assert.equal(r.hasta, '2026-11-29')
    assert.equal(r.inicio.toISOString(), '2026-11-01T00:00:00.000Z')
    assert.equal(r.inicioAnterior.toISOString(), '2026-10-03T00:00:00.000Z')
    assert.equal(rangoProduccionArgentina('2026-11-01', '2026-11-30').dias, 30)
})

test('calcula aptos, rechazo, ritmo y presentación real; excluye anulados y activos', () => {
    const r = calcularReporteProduccion([
        lote('antes', '2026-11-01', 5),
        lote('uno', '2026-11-02', 10, 2),
        lote('dos', '2026-11-03', 6),
        lote('anulado', '2026-11-03', 100, 0, 'cancelado'),
        lote('activo', '2026-11-03', 100, 0, 'en_produccion'),
    ], '2026-11-02', '2026-11-03')
    assert.equal(r.globales.totalPaquetes, 16)
    assert.equal(r.globales.totalAptos, 14)
    assert.equal(r.globales.totalRechazados, 2)
    assert.equal(r.globales.tasaRechazo, 12.5)
    assert.equal(r.globales.totalPlanchas, 32)
    assert.equal(r.globales.totalSanguchitos, 256)
    assert.equal(r.globales.totalLotes, 2)
    assert.equal(r.globales.diasActivos, 2)
    assert.equal(r.globales.promedioPorDiaActivo, 8)
    assert.equal(r.globales.diaPico?.fecha, '2026-11-02')
    assert.equal(r.globales.paquetesAnteriores, 5)
    assert.equal(r.desglose[0].participacion, 100)
    assert.deepEqual(r.tendencia.map(t => t.paquetes), [10, 6])
})

test('señala cuando no se puede identificar la presentación usada por un lote', () => {
    const sinBase = lote('viejo', '2026-11-02', 3)
    sinBase.distribucion = null
    const r = calcularReporteProduccion([sinBase], '2026-11-02', '2026-11-02')
    assert.equal(r.globales.presentacionEstimada, 1)
    assert.equal(r.globales.totalPlanchas, 18)
})

test('recupera la presentación desde un movimiento inequívoco', () => {
    const antiguo = lote('antiguo', '2026-11-02', 3)
    antiguo.distribucion = null
    antiguo.movimientosProducto = [{ presentacionId: 'p16' }]
    const r = calcularReporteProduccion([antiguo], '2026-11-02', '2026-11-02')
    assert.equal(r.globales.presentacionEstimada, 0)
    assert.equal(r.globales.totalPlanchas, 6)
})

test('la comparación usa sólo el período anterior y la evolución cubre todo el rango filtrado', () => {
    const r = calcularReporteProduccion([
        lote('fuera', '2026-10-01', 99),
        lote('previo', '2026-10-31', 4),
        lote('primero', '2026-11-01', 2),
        lote('ultimo', '2026-11-30', 3),
    ], '2026-11-01', '2026-11-30')
    assert.equal(r.globales.totalPaquetes, 5)
    assert.equal(r.globales.paquetesAnteriores, 4)
    assert.equal(r.globales.variacionPaquetes, 25)
    assert.equal(r.tendencia.length, 30)
    assert.equal(r.tendencia[0].paquetes, 2)
    assert.equal(r.tendencia[29].paquetes, 3)
    const largo = calcularReporteProduccion([lote('primero', '2026-10-01', 3)], '2026-10-01', '2026-11-30')
    assert.equal(largo.tendencia.length, 9)
    assert.equal(largo.tendencia[0].paquetes, 3)
})
