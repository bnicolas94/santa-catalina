import assert from 'node:assert/strict'
import test from 'node:test'
import { instanteRRHH } from './fechas'
import { resolverHorarioPlanificado, minutosTardanzaHorario, validarHorarioEsperado, type PlanificacionHorario } from './horarios'
import { calcularResumenDia } from '@/utils/horas'

const horario = { horaInicio: '12:00', horaFin: '20:00', horasEsperadas: 8, toleranciaMinutos: 10 }
const plan: PlanificacionHorario = {
    plantillas: [{ empleadoId: 'e', vigenciaDesde: instanteRRHH('2026-09-01'), dias: [{ diaSemana: 1, ...horario }] }],
    excepciones: [{ empleadoId: 'e', fecha: instanteRRHH('2026-09-14'), detalle: { ...horario, horaInicio: '09:00', horaFin: '17:00' } }],
}
test('la excepción prevalece y la plantilla nunca se aplica retroactivamente', () => {
    assert.equal(resolverHorarioPlanificado(plan, 'e', '2026-08-31'), null)
    assert.equal(resolverHorarioPlanificado(plan, 'e', '2026-09-07')?.horaInicio, '12:00')
    assert.equal(resolverHorarioPlanificado(plan, 'e', '2026-09-14')?.horaInicio, '09:00')
    assert.equal(resolverHorarioPlanificado(plan, 'otro', '2026-09-07'), null)
})
test('entrar a las 12 no es tardanza para el turno 12 a 20', () => {
    assert.equal(minutosTardanzaHorario(instanteRRHH('2026-09-07', '12:00:00'), horario), 0)
    assert.equal(minutosTardanzaHorario(instanteRRHH('2026-09-07', '12:15:00'), horario), 5)
})
test('la entrada anticipada no suma extras y la jornada rotativa sí reconoce excedentes', () => {
    const calcular = (salida: string) => calcularResumenDia([
        { tipo: 'entrada', fechaHora: instanteRRHH('2026-09-07', '11:00:00') },
        { tipo: 'salida', fechaHora: instanteRRHH('2026-09-07', salida) },
    ], 8, { horarioEntrada: '12:00' })
    assert.equal(calcular('20:00:00').horasExtras, 0)
    assert.equal(calcular('21:00:00').horasExtras, 1)
})
test('rechaza franjas y tolerancias inválidas', () => {
    assert.throws(() => validarHorarioEsperado({ ...horario, horaFin: '10:00' }))
    assert.throws(() => validarHorarioEsperado({ ...horario, horasEsperadas: 9 }))
    assert.throws(() => validarHorarioEsperado({ ...horario, toleranciaMinutos: -1 }))
})
test('un franco por fecha prevalece sobre la plantilla y no genera tardanza', () => {
    const franco = validarHorarioEsperado({ esFranco: true })
    const horario = resolverHorarioPlanificado({ ...plan, excepciones: [{ empleadoId: 'e', fecha: instanteRRHH('2026-09-07'), detalle: franco }] }, 'e', '2026-09-07')
    assert.equal(horario?.esFranco, true)
    assert.equal(minutosTardanzaHorario(instanteRRHH('2026-09-07', '14:00:00'), horario!), 0)
})
test('restablecer una excepción recupera la plantilla sin eliminar su versión', () => {
    const restaurado = resolverHorarioPlanificado({ ...plan, excepciones: [{ empleadoId: 'e', fecha: instanteRRHH('2026-09-14'), detalle: {} }] }, 'e', '2026-09-14')
    assert.equal(restaurado?.horaInicio, '12:00')
    assert.equal(plan.plantillas.length, 1)
})
