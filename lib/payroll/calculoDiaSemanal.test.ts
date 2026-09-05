import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularDiaSemanal, type CalculoDiaSemanalInput } from './calculoDiaSemanal'

const base: CalculoDiaSemanalInput = {
    horasTrabajadas: 9,
    horasExtras: 0,
    horasJornada: 9,
    jornalBase: 10_000,
    valorHora: 10_000 / 9,
    valorHoraExtra: 2_000,
    tieneMarcas: true,
    esFeriado: false,
}

test('paga el jornal completo al trabajar la jornada esperada', () => {
    const resultado = calcularDiaSemanal(base)

    assert.equal(resultado.multiplicadorJornal, 1)
    assert.equal(resultado.valorDiaBase, 10_000)
    assert.equal(resultado.totalDia, 10_000)
})

test('prorratea el jornal cuando las horas reales son menores a las esperadas', () => {
    const resultado = calcularDiaSemanal({ ...base, horasTrabajadas: 8 })

    assert.equal(resultado.multiplicadorJornal, 8 / 9)
    assert.equal(Math.round(resultado.valorDiaBase), 8_889)
})

test('limita el jornal al día completo y paga el excedente como horas extra', () => {
    const resultado = calcularDiaSemanal({ ...base, horasTrabajadas: 10, horasExtras: 1 })

    assert.equal(resultado.valorDiaBase, 10_000)
    assert.equal(resultado.valorExtra, 2_000)
    assert.equal(resultado.totalDia, 12_000)
})

test('redondea las horas extra al medio punto más cercano', () => {
    assert.equal(calcularDiaSemanal({ ...base, horasExtras: 0.74 }).horasExtras, 0.5)
    assert.equal(calcularDiaSemanal({ ...base, horasExtras: 0.76 }).horasExtras, 1)
})

test('cuatro horas de domingo completan un jornal normal', () => {
    const resultado = calcularDiaSemanal({
        ...base,
        horasTrabajadas: 4,
        horasExtras: 0,
        horasJornada: 4,
    })

    assert.equal(resultado.multiplicadorJornal, 1)
    assert.equal(resultado.valorDiaBase, 10_000)
    assert.equal(resultado.valorExtra, 0)
})

test('paga una ausencia justificada paga aunque no existan fichadas', () => {
    const resultado = calcularDiaSemanal({
        ...base,
        horasTrabajadas: 0,
        tieneMarcas: false,
        tipoInasistencia: 'JUSTIFICADA_PAGA',
    })

    assert.equal(resultado.multiplicadorJornal, 1)
    assert.equal(resultado.valorDiaBase, 10_000)
})

test('no paga una ausencia no remunerada ni un día sin fichadas', () => {
    const ausencia = calcularDiaSemanal({
        ...base,
        horasTrabajadas: 0,
        tieneMarcas: false,
        tipoInasistencia: 'AUSENCIA',
    })
    const sinRegistro = calcularDiaSemanal({ ...base, horasTrabajadas: 0, tieneMarcas: false })

    assert.equal(ausencia.totalDia, 0)
    assert.equal(sinRegistro.totalDia, 0)
})

test('mantiene el recargo feriado vigente sobre una jornada completa', () => {
    const resultado = calcularDiaSemanal({ ...base, horasTrabajadas: 8, esFeriado: true })

    assert.equal(Math.round(resultado.valorDiaBase), 8_889)
    assert.equal(Math.round(resultado.valorFeriado), 5_000)
    assert.equal(Math.round(resultado.totalDia), 13_889)
})
