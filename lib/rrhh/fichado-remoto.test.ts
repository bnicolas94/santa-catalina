import assert from 'node:assert/strict'
import test from 'node:test'
import { accionPermitida, esAccionFichadoRemoto, estadoFichadoRemoto, ORIGEN_FICHADO_REMOTO, tipoParaAccionRemota } from './fichado-remoto'
import { calcularResumenDia } from '../../utils/horas'
import { calcularDiaSemanal } from '../payroll/calculoDiaSemanal'

test('el descanso queda fuera de las horas de nómina y conserva su origen', () => {
    const acciones = ['entrada', 'inicio_descanso', 'fin_descanso', 'salida'] as const
    const horas = ['09:00', '12:00', '12:30', '18:00']
    const marcas = acciones.map((accion, i) => ({
        tipo: tipoParaAccionRemota(accion),
        origen: ORIGEN_FICHADO_REMOTO[accion],
        fechaHora: new Date(`2026-11-10T${horas[i]}:00-03:00`),
    }))
    assert.equal(calcularResumenDia(marcas, 8).horasTrabajadas, 8.5)
    assert.equal(estadoFichadoRemoto(marcas.slice(0, 2)), 'descansando')
    assert.equal(estadoFichadoRemoto(marcas), 'finalizado')
})

test('las acciones siguen una sola jornada sin duplicados', () => {
    assert.equal(esAccionFichadoRemoto('entrada'), true)
    assert.equal(esAccionFichadoRemoto('toString'), false)
    assert.equal(accionPermitida('sin_iniciar', 'entrada'), true)
    assert.equal(accionPermitida('sin_iniciar', 'salida'), false)
    assert.equal(accionPermitida('trabajando', 'entrada'), false)
    assert.equal(accionPermitida('trabajando', 'inicio_descanso'), true)
    assert.equal(accionPermitida('descansando', 'salida'), false)
    assert.equal(accionPermitida('descansando', 'fin_descanso'), true)
    assert.equal(accionPermitida('finalizado', 'entrada'), false)
})

test('dos pausas descuentan tiempo real y el jornal usa las horas efectivas', () => {
    const horas = ['09:00', '12:00', '12:30', '15:30', '16:00', '18:00']
    const acciones = ['entrada', 'inicio_descanso', 'fin_descanso', 'inicio_descanso', 'fin_descanso', 'salida'] as const
    const marcas = acciones.map((accion, indice) => ({
        tipo: tipoParaAccionRemota(accion),
        fechaHora: new Date(`2026-11-11T${horas[indice]}:00-03:00`),
    }))
    const resumen = calcularResumenDia(marcas, 8, { horarioEntrada: '09:00' })
    assert.equal(resumen.horasTrabajadas, 8)
    assert.equal(resumen.horasExtras, 0)
    const jornal = calcularDiaSemanal({
        horasTrabajadas: resumen.horasTrabajadas, horasExtras: resumen.horasExtras,
        horasJornada: 8, jornalBase: 40000, valorHora: 5000, valorHoraExtra: 7500,
        tieneMarcas: true, esFeriado: false,
    })
    assert.equal(jornal.valorDiaBase, 40000)
    assert.equal(calcularResumenDia(marcas.slice(0, 5), 8).horasTrabajadas, 6)
})
