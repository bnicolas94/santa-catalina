import assert from 'node:assert/strict'
import test from 'node:test'
import { parsearEventosVillaElisa, parsearFicheroFabrica, parsearPlanillaLocal, parsearReporteMensualLocal } from './importar-archivo'

test('interpreta el fichero de fábrica y alterna entrada/salida por jornada', () => {
    const texto = [
        '1  Persona  00007  2026/09/10 08:05:00',
        '1  Persona  00007  2026/09/10 17:30:00',
    ].join('\n')

    const resultado = parsearFicheroFabrica(texto)

    assert.equal(resultado.formato, 'Fichero de fábrica')
    assert.deepEqual(resultado.registros.map(({ codigoBiometrico, fechaHora, tipo }) => ({
        codigoBiometrico,
        fechaHora,
        tipo,
    })), [
        { codigoBiometrico: '7', fechaHora: '2026-09-10T11:05:00.000Z', tipo: 'entrada' },
        { codigoBiometrico: '7', fechaHora: '2026-09-10T20:30:00.000Z', tipo: 'salida' },
    ])
    assert.deepEqual(resultado.advertencias, [])
})

test('interpreta ambas quincenas del reporte mensual del local', () => {
    const filas = [
        ['work units:', null, null, null, 'name:Valen', null, null, 'number:00004', null, 'department:', null, null, 'date:26.09.01��26.09.30'],
        [],
        [],
        [],
        ['date', 'week', '(IN)', '(OUT)', '(IN)', '(OUT)', '(IN)', '(OUT)', null, 'date', 'week', '(IN)', '(OUT)'],
        ['09.08', 'Tue', '10:58*', '20:14 ', null, null, null, null, '09:16', '09.24', 'Thu', '09:01 ', '18:02 '],
    ]

    const resultado = parsearReporteMensualLocal(filas)

    assert.equal(resultado.formato, 'Reporte mensual del local')
    assert.deepEqual(resultado.registros.map(({ codigoBiometrico, nombreOrigen, fechaHora, tipo }) => ({
        codigoBiometrico,
        nombreOrigen,
        fechaHora,
        tipo,
    })), [
        { codigoBiometrico: '00004', nombreOrigen: 'Valen', fechaHora: '2026-09-08T13:58:00.000Z', tipo: 'entrada' },
        { codigoBiometrico: '00004', nombreOrigen: 'Valen', fechaHora: '2026-09-08T23:14:00.000Z', tipo: 'salida' },
        { codigoBiometrico: '00004', nombreOrigen: 'Valen', fechaHora: '2026-09-24T12:01:00.000Z', tipo: 'entrada' },
        { codigoBiometrico: '00004', nombreOrigen: 'Valen', fechaHora: '2026-09-24T21:02:00.000Z', tipo: 'salida' },
    ])
    assert.deepEqual(resultado.advertencias, [])
})

test('conserva una salida sin entrada para que se corrija en la vista previa', () => {
    const filas = [
        ['work units:', null, null, null, 'name:Valen', null, null, 'number:00004', null, null, null, null, 'date:26.09.01��26.09.30'],
        ['09.08', 'Tue', '      ', '20:05 '],
    ]

    const resultado = parsearReporteMensualLocal(filas)

    assert.equal(resultado.registros.length, 1)
    assert.equal(resultado.registros[0].tipo, 'salida')
    assert.equal(resultado.advertencias.length, 1)
    assert.match(resultado.advertencias[0], /Valen \(08\/09\/2026\)/)
})

test('rechaza una planilla que no es el reporte mensual del reloj local', () => {
    assert.throws(
        () => parsearReporteMensualLocal([['Empleado', 'Fecha', 'Hora']]),
        /no tiene el formato de reporte mensual/i,
    )
})

test('interpreta la tabla de eventos de Villa Elisa y alterna las marcas por jornada', () => {
    const resultado = parsearEventosVillaElisa([
        ['ID de usuario', 'Fecha/Hora', 'Dispositivo Nro.', 'Registro'],
        ['2', 46279.5, 0, '0'],
        ['2', 46279.833333333336, 0, '1'],
        ['3', '2026-09-16 16:57:25', 1, '0'],
        ['3', '2026-09-16 20:14:59', 1, '0'],
    ])

    assert.equal(resultado.formato, 'Eventos de Villa Elisa')
    assert.deepEqual(resultado.registros.map(({ codigoBiometrico, fechaHora, tipo }) => ({ codigoBiometrico, fechaHora, tipo })), [
        { codigoBiometrico: '2', fechaHora: '2026-09-14T15:00:00.000Z', tipo: 'entrada' },
        { codigoBiometrico: '2', fechaHora: '2026-09-14T23:00:00.000Z', tipo: 'salida' },
        { codigoBiometrico: '3', fechaHora: '2026-09-16T19:57:25.000Z', tipo: 'entrada' },
        { codigoBiometrico: '3', fechaHora: '2026-09-16T23:14:59.000Z', tipo: 'salida' },
    ])
    assert.deepEqual(resultado.advertencias, [])
})

test('Villa Elisa conserva una marca impar para corregirla en la vista previa', () => {
    const resultado = parsearEventosVillaElisa([
        ['ID de usuario', 'Fecha/Hora', 'Dispositivo Nro.', 'Registro'],
        ['6', 46281.70384259259, 1, '0'],
    ])
    assert.equal(resultado.registros[0].tipo, 'entrada')
    assert.equal(resultado.advertencias.length, 1)
    assert.match(resultado.advertencias[0], /reloj 6 \(16\/09\/2026\)/)
})

test('el selector de planillas mantiene el reporte mensual anterior', () => {
    const resultado = parsearPlanillaLocal([
        ['work units:', null, null, null, 'name:Valen', null, null, 'number:00004', null, null, null, null, 'date:26.09.01��26.09.30'],
        ['09.08', 'Tue', '10:58', '20:14'],
    ])
    assert.equal(resultado.formato, 'Reporte mensual del local')
})
