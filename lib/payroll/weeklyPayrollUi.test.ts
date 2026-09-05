import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularTotalNeto, fusionarRecalculoEmpleado, minutesToTimeDisplay, obtenerAlertasLiquidacion, parseTimeToMinutes, recalcularDiaPorHoras, recalcularResultado, resumirDesglose, sumarAdicionales, toTimeInputValue } from '../../components/empleados/weeklyPayroll.utils'
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

test('un ajuste diario actualiza los totales sin incorporar deudas de otras semanas', () => {
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
    assert.equal(resultado.totalNeto, 11_300)
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

test('cambiar una situación conserva los ajustes manuales de los demás días', () => {
    const diaAjustado = recalcularDiaPorHoras({
        fecha: '2026-08-24', diaSemana: 'Lunes', esFeriado: false,
        horasTrabajadas: 9, horasExtras: 0, entrada: '09:00', salida: '18:00',
        jornalBase: 30_000, valorDiaBase: 30_000, multiplicadorJornal: 1,
        valorExtra: 0, valorFeriado: 0, totalDia: 30_000, esJustificado: false,
    }, 8, 9, 6_000)
    const franco: DiaLiquidacionUI = {
        fecha: '2026-08-25', diaSemana: 'Martes', esFeriado: false,
        horasTrabajadas: 0, horasExtras: 0, entrada: null, salida: null,
        jornalBase: 30_000, valorDiaBase: 0, multiplicadorJornal: 0,
        valorExtra: 0, valorFeriado: 0, totalDia: 0, esJustificado: false,
        tipoInasistencia: 'FRANCO', motivoInasistencia: 'Franco', esFranco: true,
    }
    const actual: ResultadoLiquidacionUI = {
        empleadoId: 'e1', empleadoNombre: 'Ana', periodo: 'semana', diasTrabajados: 1,
        horasNormales: 8, horasExtras: 0, horasFeriado: 0, sueldoBase: 26_667,
        valorHoraExtra: 6_000, horasJornada: 9, montoHorasExtras: 12_000,
        montoHorasFeriado: 0, descuentoPrestamos: 1_000, horasPendientes: 0,
        montoHorasPendientes: 0, totalNeto: 38_167, ajusteHorasExtras: 2,
        adicionales: [{ conceptoSalarialId: 'premio', montoCalculado: 500 }],
        desglosePorDia: [diaAjustado, franco], borradorId: 'b1',
    }
    const recalculado = {
        ...actual,
        ajusteHorasExtras: 0,
        borradorId: undefined,
        desglosePorDia: [
            {
                ...diaAjustado,
                horasTrabajadas: 9,
                valorDiaBase: 30_000,
                multiplicadorJornal: 1,
                totalDia: 30_000,
                ajusteManual: false,
            },
            {
                ...franco,
                tipoInasistencia: 'INJUSTIFICADA',
                motivoInasistencia: 'Ausencia sin aviso',
                esFranco: false,
            },
        ],
    }
    const fusionado = fusionarRecalculoEmpleado(actual, recalculado, '2026-08-25')

    assert.deepEqual(fusionado.desglosePorDia[0], { ...diaAjustado, horasJornada: 9 })
    assert.equal(fusionado.desglosePorDia[1].tipoInasistencia, 'INJUSTIFICADA')
    assert.equal(fusionado.desglosePorDia[1].horasExtras, 0)
    assert.equal(fusionado.ajusteHorasExtras, 2)
    assert.deepEqual(fusionado.adicionales, actual.adicionales)
    assert.equal(fusionado.borradorId, 'b1')
    assert.equal(fusionado.totalNeto, 38_167)
})

test('el día cuya situación cambia adopta el cálculo nuevo aunque estuviera ajustado', () => {
    const trabajado = recalcularDiaPorHoras({
        fecha: '2026-08-24', diaSemana: 'Lunes', esFeriado: false,
        horasTrabajadas: 10, horasExtras: 1, entrada: '08:00', salida: '18:00',
        jornalBase: 30_000, valorDiaBase: 30_000, multiplicadorJornal: 1,
        valorExtra: 6_000, valorFeriado: 0, totalDia: 36_000, esJustificado: false,
    }, 10, 9, 6_000)
    const sinAviso: DiaLiquidacionUI = {
        ...trabajado,
        horasTrabajadas: 0, horasExtras: 0, entrada: null, salida: null,
        valorDiaBase: 0, multiplicadorJornal: 0, valorExtra: 0, totalDia: 0,
        ajusteManual: false, tipoInasistencia: 'INJUSTIFICADA',
        motivoInasistencia: 'Ausencia sin aviso', esInasistencia: true,
    }
    const actual: ResultadoLiquidacionUI = {
        empleadoId: 'e1', empleadoNombre: 'Ana', periodo: 'semana', diasTrabajados: 1,
        horasNormales: 9, horasExtras: 1, horasFeriado: 0, sueldoBase: 30_000,
        valorHoraExtra: 6_000, horasJornada: 9, montoHorasExtras: 6_000,
        montoHorasFeriado: 0, descuentoPrestamos: 0, horasPendientes: 0,
        montoHorasPendientes: 0, totalNeto: 36_000, adicionales: [],
        desglosePorDia: [trabajado],
    }
    const recalculado = { ...actual, desglosePorDia: [sinAviso] }

    const fusionado = fusionarRecalculoEmpleado(actual, recalculado, '2026-08-24')

    assert.deepEqual(fusionado.desglosePorDia[0], sinAviso)
    assert.equal(fusionado.totalNeto, 0)
})

test('un ajuste manual conserva sus horas pero adopta los valores salariales vigentes', () => {
    const diaViejo: DiaLiquidacionUI = {
        fecha: '2026-09-05', diaSemana: 'Sábado', esFeriado: false,
        horasTrabajadas: 11, horasJornada: 8, horasExtras: 3,
        entrada: '09:00', salida: '20:00', jornalBase: 40_976,
        valorDiaBase: 40_976, multiplicadorJornal: 1, valorExtra: 28_455,
        valorFeriado: 0, totalDia: 69_431, esJustificado: false,
        ajusteManual: true,
    }
    const diaVigente: DiaLiquidacionUI = {
        ...diaViejo,
        jornalBase: 43_400,
        valorDiaBase: 0,
        valorExtra: 0,
        totalDia: 0,
        ajusteManual: false,
    }
    const actual: ResultadoLiquidacionUI = {
        empleadoId: 'german', empleadoNombre: 'Germán', periodo: 'semana', diasTrabajados: 1,
        horasNormales: 8, horasExtras: 3, horasFeriado: 0, sueldoBase: 40_976,
        valorHoraExtra: 9_485, horasJornada: 8, montoHorasExtras: 28_455,
        montoHorasFeriado: 0, descuentoPrestamos: 0, horasPendientes: 0,
        montoHorasPendientes: 0, totalNeto: 69_431, adicionales: [],
        desglosePorDia: [diaViejo],
    }
    const vigente = {
        ...actual,
        sueldoBase: 0,
        valorHoraExtra: 9_650,
        montoHorasExtras: 0,
        totalNeto: 0,
        desglosePorDia: [diaVigente],
    }

    const fusionado = fusionarRecalculoEmpleado(actual, vigente)

    assert.equal(fusionado.desglosePorDia[0].horasTrabajadas, 11)
    assert.equal(fusionado.desglosePorDia[0].jornalBase, 43_400)
    assert.equal(fusionado.desglosePorDia[0].valorDiaBase, 43_400)
    assert.equal(fusionado.desglosePorDia[0].valorExtra, 28_950)
    assert.equal(fusionado.totalNeto, 72_350)
})
