import assert from 'node:assert/strict'
import test from 'node:test'
import { novedadRRHHBloqueaSeguimientoGuardado, seleccionarInasistenciaPreferida } from './inasistencias'

test('prioriza una licencia paga sobre una ausencia automática injustificada', () => {
    const seleccionada = seleccionarInasistenciaPreferida([
        { tipo: 'INJUSTIFICADA', id: 'automatica' },
        { tipo: 'JUSTIFICADA_PAGA', id: 'licencia' },
    ])

    assert.equal(seleccionada?.id, 'licencia')
})

test('vacaciones tienen prioridad sobre otros estados del mismo día', () => {
    const seleccionada = seleccionarInasistenciaPreferida([
        { tipo: 'JUSTIFICADA_PAGA', id: 'licencia' },
        { tipo: 'VACACIONES', id: 'vacaciones' },
    ])

    assert.equal(seleccionada?.id, 'vacaciones')
})

test('un estado operativo de trabajo no descarta las horas ajustadas del seguimiento', () => {
    assert.equal(novedadRRHHBloqueaSeguimientoGuardado('TRABAJO'), false)
    assert.equal(novedadRRHHBloqueaSeguimientoGuardado('INJUSTIFICADA'), false)
    assert.equal(novedadRRHHBloqueaSeguimientoGuardado(undefined), false)
    assert.equal(novedadRRHHBloqueaSeguimientoGuardado('VACACIONES'), true)
    assert.equal(novedadRRHHBloqueaSeguimientoGuardado('JUSTIFICADA_PAGA'), true)
})
