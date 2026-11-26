import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularConciliacionInsumos, type ConteoConciliacion, type MovimientoConciliacion } from './conciliacion-insumos'

const conteo = (id: string, cantidad: number): ConteoConciliacion => ({ id,
    fecha: new Date(id === 'inicio' ? '2026-11-01T20:00:00Z' : '2026-11-08T20:00:00Z'),
    detalles: [{ insumoId: 'pan', cantidadContada: cantidad,
        insumo: { nombre: 'Pan blanco', unidadMedida: 'kg', precioUnitario: 1000 } }] })
const movimiento = (tipo: string, cantidad: number, loteOrigenId: string | null = null): MovimientoConciliacion => ({
    insumoId: 'pan', tipo, cantidad, loteOrigenId, detalleConteo: null,
})

test('separa producción de entradas y mermas y calcula faltante entre dos conteos', () => {
    const r = calcularConciliacionInsumos(conteo('inicio', 100), conteo('fin', 64), [
        movimiento('entrada', 20), movimiento('salida', 50, 'lote-1'),
        movimiento('entrada', 10, 'lote-1'), movimiento('merma', 5),
    ])
    assert.equal(r.filas[0].usoRegistrado, 40)
    assert.equal(r.filas[0].usoSegunConteo, 51)
    assert.equal(r.filas[0].stockEsperado, 75)
    assert.equal(r.filas[0].diferencia, 11)
    assert.equal(r.filas[0].estado, 'faltante')
    assert.equal(r.resumen.costoFaltanteIdentificado, 11000)
})

test('ignora ajustes propios del conteo y marca insumos sin ambos extremos', () => {
    const final = conteo('fin', 80)
    final.detalles.push({ insumoId: 'extra', cantidadContada: 4,
        insumo: { nombre: 'Extra', unidadMedida: 'u', precioUnitario: 1 } })
    const r = calcularConciliacionInsumos(conteo('inicio', 100), final, [
        movimiento('salida', 20, 'lote-1'), { ...movimiento('salida', 9), detalleConteo: { id: 'ajuste' } },
    ])
    assert.equal(r.filas[0].estado, 'coincide')
    assert.deepEqual(r.sinPar, ['Extra'])
})

test('no presenta como uso excesivo un movimiento cuyo tipo no se puede interpretar', () => {
    const r = calcularConciliacionInsumos(conteo('inicio', 100), conteo('fin', 80), [
        movimiento('salida', 20, 'lote-1'), movimiento('ajuste', 3),
    ])
    assert.equal(r.filas[0].estado, 'revisar')
    assert.equal(r.filas[0].movimientosNoReconocidos, 1)
    assert.equal(r.resumen.faltantes, 0)
})
