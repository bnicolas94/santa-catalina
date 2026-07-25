import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularTotalNeto, minutesToTimeDisplay, obtenerAlertasLiquidacion, parseTimeToMinutes, recalcularDiaPorHoras, recalcularResultado, resumirDesglose, sumarAdicionales, toTimeInputValue } from '../../components/empleados/weeklyPayroll.utils'
import type { DiaLiquidacionUI, ResultadoLiquidacionUI } from '../../components/empleados/weeklyPayroll.types'

test('interpreta horarios de 24 y 12 horas', () => {
    assert.equal(parseTimeToMinutes('14:30'), 870)
    assert.equal(parseTimeToMinutes('02:30 PM'), 870)
    assert.equal(parseTimeToMinutes('12:00 AM'), 0)
    assert.equal(parseTimeToMinutes('12:00 PM'), 720)
})

test('rechaza horarios fuera de rango', () => {
    assert.equal(parseTimeToMinutes('25:00'), null)
    assert.equal(parseTimeToMinutes('10:75'), null)
    assert.equal(parseTimeToMinutes(null), null)
})

test('convierte minutos para mostrar y editar', () => {
    assert.equal(minutesToTimeDisplay(870), '02:30 PM')
    assert.equal(toTimeInputValue('02:30 PM'), '14:30')
    assert.equal(toTimeInputValue(null), '')
})

test('resume el desglose y calcula el neto en un solo lugar', () => {
    const dia: DiaLiquidacionUI = {
        fecha: '2026-07-20', diaSemana: 'Lunes', esFeriado: false,
        horasTrabajadas: 8, horasExtras: 1, entrada: '08:00', salida: '17:00',
        jornalBase: 10_000, valorDiaBase: 8_000, multiplicadorJornal: 0.8,
        valorExtra: 2_000, valorFeriado: 0, totalDia: 10_000, esJustificado: false,
    }
    const resumen = resumirDesglose([dia])
    const adicionales = sumarAdicionales([{ conceptoSalarialId: 'premio', montoCalculado: 500 }])

    assert.deepEqual(resumen, {
        sueldoBase: 8_000,
        horasExtras: 1,
        montoHorasExtras: 2_000,
        montoHorasFeriado: 0,
        diasTrabajados: 1,
    })
    assert.equal(calcularTotalNeto({
        sueldoBase: resumen.sueldoBase,
        montoHorasExtras: resumen.montoHorasExtras,
        montoHorasFeriado: resumen.montoHorasFeriado,
        montoAdicionales: adicionales,
        descuentoPrestamos: 1_000,
    }), 9_500)
})

test('al editar horas reales prorratea el jornal y marca el día como ajustado', () => {
    const dia: DiaLiquidacionUI = {
        fecha: '2026-07-20', diaSemana: 'Lunes', esFeriado: false,
        horasTrabajadas: 9, horasExtras: 0, entrada: '08:00', salida: '17:00',
        jornalBase: 10_000, valorDiaBase: 10_000, multiplicadorJornal: 1,
        valorExtra: 0, valorFeriado: 0, totalDia: 10_000, esJustificado: false,
    }
    const ajustado = recalcularDiaPorHoras(dia, 8, 9, 2_000)

    assert.equal(ajustado.multiplicadorJornal, 8 / 9)
    assert.equal(ajustado.valorDiaBase, 8_889)
    assert.equal(ajustado.horasExtras, 0)
    assert.equal(ajustado.totalDia, 8_889)
    assert.equal(ajustado.ajusteManual, true)
})

test('un ajuste diario actualiza todos los totales derivados sin perder adicionales ni deuda', () => {
    const dia = recalcularDiaPorHoras({
        fecha: '2026-07-20', diaSemana: 'Lunes', esFeriado: false,
        horasTrabajadas: 9, horasExtras: 0, entrada: '08:00', salida: '17:00',
        jornalBase: 10_000, valorDiaBase: 10_000, multiplicadorJornal: 1,
        valorExtra: 0, valorFeriado: 0, totalDia: 10_000, esJustificado: false,
    }, 10, 9, 2_000)
    const resultado = recalcularResultado({
        empleadoId: 'e1', empleadoNombre: 'Ana', periodo: 'semana', diasTrabajados: 1,
        horasNormales: 9, horasExtras: 0, horasFeriado: 0, sueldoBase: 10_000,
        valorHoraExtra: 2_000, horasJornada: 9, montoHorasExtras: 0,
        montoHorasFeriado: 0, descuentoPrestamos: 1_000, horasPendientes: 1,
        montoHorasPendientes: 500, totalNeto: 0, desglosePorDia: [dia],
        adicionales: [{ conceptoSalarialId: 'premio', montoCalculado: 300 }],
    } satisfies ResultadoLiquidacionUI)

    assert.equal(resultado.sueldoBase, 10_000)
    assert.equal(resultado.horasNormales, 9)
    assert.equal(resultado.horasExtras, 1)
    assert.equal(resultado.montoHorasExtras, 2_000)
    assert.equal(resultado.totalNeto, 11_800)
})

test('bloquea marcas incompletas y advierte diferencias en horas ajustadas', () => {
    const base: ResultadoLiquidacionUI = {
        empleadoId: 'e1', empleadoNombre: 'Ana', periodo: 'semana', diasTrabajados: 1,
        horasNormales: 8, horasExtras: 0, horasFeriado: 0, sueldoBase: 10_000,
        valorHoraExtra: 2_000, horasJornada: 9, montoHorasExtras: 0,
        montoHorasFeriado: 0, descuentoPrestamos: 0, horasPendientes: 0,
        montoHorasPendientes: 0, totalNeto: 10_000, adicionales: [],
        desglosePorDia: [{
            fecha: '2026-07-20', diaSemana: 'Lunes', esFeriado: false,
            horasTrabajadas: 8, horasExtras: 0, entrada: '08:00', salida: null,
            jornalBase: 10_000, valorDiaBase: 8_889, multiplicadorJornal: 8 / 9,
            valorExtra: 0, valorFeriado: 0, totalDia: 8_889, esJustificado: false,
        }],
    }
    assert.equal(obtenerAlertasLiquidacion(base)[0].nivel, 'error')

    base.desglosePorDia[0] = { ...base.desglosePorDia[0], salida: '17:00', ajusteManual: true }
    const alertas = obtenerAlertasLiquidacion(base)
    assert.equal(alertas.length, 1)
    assert.equal(alertas[0].nivel, 'warning')
})
