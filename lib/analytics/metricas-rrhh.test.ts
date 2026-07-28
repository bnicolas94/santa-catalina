import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularAusentismoRRHH, calcularPuntualidadRRHH, esDiaLaboralRRHH, valorDiaEmpleado } from './metricas-rrhh'

test('la tardanza se calcula sobre entradas y respeta tolerancia y zona horaria', () => {
    const resultado = calcularPuntualidadRRHH([
        { empleadoId: 'e1', empleadoNombre: 'Ana', fechaHora: '2026-07-20T11:05:00.000Z', horaObjetivo: '08:00', toleranciaMinutos: 10 },
        { empleadoId: 'e1', empleadoNombre: 'Ana', fechaHora: '2026-07-21T11:15:00.000Z', horaObjetivo: '08:00', toleranciaMinutos: 10 },
    ])

    assert.equal(resultado.totalEntradas, 2)
    assert.equal(resultado.tardanzas, 1)
    assert.equal(resultado.porcentajeTardanzas, 50)
    assert.equal(resultado.detalleTardanzas[0].minutosRetraso, 15)
    assert.equal(resultado.indicePuntualidad[0].porcentaje, 50)
})

test('una entrada sin horario no mejora artificialmente la puntualidad', () => {
    const resultado = calcularPuntualidadRRHH([
        { empleadoId: 'e1', empleadoNombre: 'Ana', fechaHora: '2026-07-20T11:00:00.000Z' },
    ])
    assert.equal(resultado.totalEntradas, 0)
    assert.equal(resultado.indicePuntualidad.length, 0)
})

test('el ausentismo usa jornadas programadas, excluye feriados y no duplica días', () => {
    const resultado = calcularAusentismoRRHH({
        empleados: [{ id: 'e1', nombre: 'Ana', diasTrabajoSemana: 'Lunes a Viernes', jornal: 60_000, cicloPago: 'SEMANAL' }],
        ausencias: [
            { empleadoId: 'e1', fecha: '2026-07-20T15:00:00-03:00', tipo: 'INJUSTIFICADA' },
            { empleadoId: 'e1', fecha: '2026-07-20T18:00:00-03:00', tipo: 'INJUSTIFICADA' },
            { empleadoId: 'e1', fecha: '2026-07-21T15:00:00-03:00', tipo: 'FRANCO' },
        ],
        feriados: ['2026-07-22T12:00:00-03:00'],
        desde: '2026-07-20',
        hasta: '2026-07-24',
    })

    assert.equal(resultado.jornadasEsperadas, 4)
    assert.equal(resultado.ausencias, 1)
    assert.equal(resultado.porcentajeAusentismo, 25)
    assert.equal(resultado.costoAusentismo, 10_000)
})

test('interpreta configuraciones comunes y valores diarios por ciclo', () => {
    assert.equal(esDiaLaboralRRHH('Lunes a Viernes', 6), false)
    assert.equal(esDiaLaboralRRHH('Lunes a Sábado', 6), true)
    assert.equal(valorDiaEmpleado({ id: 'e1', nombre: 'Ana', jornal: 30_000, cicloPago: 'QUINCENAL' }), 2_000)
    assert.equal(valorDiaEmpleado({ id: 'e2', nombre: 'Juan', sueldoBaseMensual: 300_000 }), 10_000)
})

test('las vacaciones reducen la dotación esperada y no cuentan como ausentismo', () => {
    const resultado = calcularAusentismoRRHH({
        empleados: [{ id: 'e1', nombre: 'Ana', diasTrabajoSemana: 'Lunes a Viernes', jornal: 60_000, cicloPago: 'SEMANAL' }],
        ausencias: [
            { empleadoId: 'e1', fecha: '2026-07-20T12:00:00-03:00', tipo: 'VACACIONES' },
            { empleadoId: 'e1', fecha: '2026-07-21T12:00:00-03:00', tipo: 'VACACIONES' },
        ],
        feriados: [],
        desde: '2026-07-20',
        hasta: '2026-07-24',
    })

    assert.equal(resultado.jornadasEsperadas, 3)
    assert.equal(resultado.ausencias, 0)
    assert.equal(resultado.porcentajeAusentismo, 0)
})
