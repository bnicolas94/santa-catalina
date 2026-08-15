import assert from 'node:assert/strict'
import test from 'node:test'

import { agruparFichadasPorDia, calcularResumenDia, type Marca } from '../../utils/horas'

function fechaLocal(
    anio: number,
    mes: number,
    dia: number,
    hora: number,
    minuto: number = 0,
): Date {
    return new Date(anio, mes - 1, dia, hora, minuto, 0, 0)
}

test('calcula una jornada a partir de una entrada y una salida', () => {
    const marcas: Marca[] = [
        { tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 8) },
        { tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 17) },
    ]

    assert.deepEqual(calcularResumenDia(marcas, 9), {
        horasTrabajadas: 9,
        horasExtras: 0,
        esAusencia: false,
        marcas,
    })
})

test('suma varios tramos trabajados durante el mismo día', () => {
    const marcas: Marca[] = [
        { tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 8) },
        { tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 12) },
        { tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 13) },
        { tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 18) },
    ]

    const resultado = calcularResumenDia(marcas, 8)

    assert.equal(resultado.horasTrabajadas, 9)
    assert.equal(resultado.horasExtras, 1)
})

test('no computa como trabajadas ni extras las horas anteriores al horario de entrada', () => {
    const marcas: Marca[] = [
        { tipo: 'entrada', fechaHora: '2026-07-20T07:00:00-03:00' },
        { tipo: 'salida', fechaHora: '2026-07-20T17:00:00-03:00' },
    ]

    const resultado = calcularResumenDia(marcas, 9, { horarioEntrada: '08:00' })

    assert.equal(resultado.horasTrabajadas, 9)
    assert.equal(resultado.horasExtras, 0)
})

test('mantiene como extra el tiempo posterior a la jornada aunque la entrada haya sido anticipada', () => {
    const marcas: Marca[] = [
        { tipo: 'entrada', fechaHora: '2026-07-20T07:00:00-03:00' },
        { tipo: 'salida', fechaHora: '2026-07-20T18:00:00-03:00' },
    ]

    const resultado = calcularResumenDia(marcas, 9, { horarioEntrada: '08:00' })

    assert.equal(resultado.horasTrabajadas, 10)
    assert.equal(resultado.horasExtras, 1)
})

test('ordena las fichadas antes de emparejar entradas y salidas', () => {
    const entrada: Marca = { tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 8) }
    const salida: Marca = { tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 16) }

    const resultado = calcularResumenDia([salida, entrada], 8)

    assert.equal(resultado.horasTrabajadas, 8)
    assert.deepEqual(resultado.marcas, [entrada, salida])
})

test('ignora una entrada sin salida para no inventar horas trabajadas', () => {
    const resultado = calcularResumenDia([
        { tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 8) },
    ], 9)

    assert.equal(resultado.horasTrabajadas, 0)
    assert.equal(resultado.horasExtras, 0)
})

test('ignora una salida sin entrada previa', () => {
    const resultado = calcularResumenDia([
        { tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 17) },
    ], 9)

    assert.equal(resultado.horasTrabajadas, 0)
})

test('una licencia con goce representa una jornada completa', () => {
    const resultado = calcularResumenDia([
        {
            tipo: 'ausencia',
            fechaHora: fechaLocal(2026, 7, 20, 8),
            tipoLicencia: { conGoceSueldo: true },
        },
    ], 9)

    assert.equal(resultado.horasTrabajadas, 9)
    assert.equal(resultado.horasExtras, 0)
    assert.equal(resultado.esAusencia, true)
})

test('una licencia sin goce no genera horas pagas', () => {
    const resultado = calcularResumenDia([
        {
            tipo: 'ausencia',
            fechaHora: fechaLocal(2026, 7, 20, 8),
            tipoLicencia: { conGoceSueldo: false },
        },
    ], 9)

    assert.equal(resultado.horasTrabajadas, 0)
    assert.equal(resultado.esAusencia, true)
})

test('agrupa por día local y mantiene las fichadas en orden cronológico', () => {
    const fichadas = [
        { id: 'salida-1', tipo: 'salida', fechaHora: fechaLocal(2026, 7, 20, 17) },
        { id: 'entrada-2', tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 21, 8) },
        { id: 'entrada-1', tipo: 'entrada', fechaHora: fechaLocal(2026, 7, 20, 8) },
    ]

    const grupos = agruparFichadasPorDia(fichadas)

    assert.deepEqual(Object.keys(grupos).sort(), ['2026-07-20', '2026-07-21'])
    assert.deepEqual(grupos['2026-07-20'].map(f => f.id), ['entrada-1', 'salida-1'])
    assert.deepEqual(grupos['2026-07-21'].map(f => f.id), ['entrada-2'])
})
