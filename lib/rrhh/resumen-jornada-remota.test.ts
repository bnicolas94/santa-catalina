import assert from 'node:assert/strict'
import test from 'node:test'
import { resumirJornadaRemota } from './resumen-jornada-remota'
import { ORIGEN_FICHADO_REMOTO, tipoParaAccionRemota, type AccionFichadoRemoto } from './fichado-remoto'

function marca(accion: AccionFichadoRemoto, hora: string) {
    return {
        tipo: tipoParaAccionRemota(accion),
        origen: ORIGEN_FICHADO_REMOTO[accion],
        fechaHora: `2026-11-11T${hora}:00-03:00`,
    }
}

test('suma trabajo y pausas cerradas, más el tramo de trabajo en curso', () => {
    const marcas = [marca('entrada', '09:00'), marca('inicio_descanso', '10:30'), marca('fin_descanso', '10:45')]
    const resumen = resumirJornadaRemota(marcas, new Date('2026-11-11T11:30:00-03:00'), 8, '09:00')
    assert.equal(resumen.minutosEfectivosConfirmados, 90)
    assert.equal(resumen.minutosEfectivosActuales, 135)
    assert.equal(resumen.minutosDescanso, 15)
    assert.equal(resumen.minutosRestantes, 345)
    assert.equal(resumen.tramoTrabajoEnCurso, true)
})

test('el descanso abierto sigue corriendo y no suma trabajo', () => {
    const marcas = [marca('entrada', '09:00'), marca('inicio_descanso', '10:30')]
    const resumen = resumirJornadaRemota(marcas, new Date('2026-11-11T11:15:00-03:00'), 8, '09:00')
    assert.equal(resumen.minutosEfectivosActuales, 90)
    assert.equal(resumen.minutosDescanso, 45)
    assert.equal(resumen.descansoEnCurso, true)
})

test('dos pausas cerradas dejan ocho horas efectivas de nueve transcurridas', () => {
    const marcas = [
        marca('entrada', '09:00'), marca('inicio_descanso', '12:00'), marca('fin_descanso', '12:30'),
        marca('inicio_descanso', '15:30'), marca('fin_descanso', '16:00'), marca('salida', '18:00'),
    ]
    const resumen = resumirJornadaRemota(marcas, new Date('2026-11-11T18:30:00-03:00'), 8, '09:00')
    assert.equal(resumen.minutosEfectivosConfirmados, 480)
    assert.equal(resumen.minutosEfectivosActuales, 480)
    assert.equal(resumen.minutosDescanso, 60)
    assert.equal(resumen.minutosRestantes, 0)
})

test('el trabajo anticipado no aumenta las horas computables', () => {
    const resumen = resumirJornadaRemota(
        [marca('entrada', '08:50')], new Date('2026-11-11T09:20:00-03:00'), 8, '09:00',
    )
    assert.equal(resumen.minutosEfectivosActuales, 20)
})
