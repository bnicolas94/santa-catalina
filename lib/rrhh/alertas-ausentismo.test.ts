import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizarReglaAusentismo } from './alertas-ausentismo'

test('ninguna regla de ausentismo puede habilitar sanciones automáticas', () => {
    const regla = normalizarReglaAusentismo({
        tipoInasistencia: 'tardanza',
        limiteMaximo: 3,
        periodoDias: 30,
        autoSancionar: true,
        tipoSancionAuto: 'SUSPENSION',
    })

    assert.equal(regla.autoSancionar, false)
    assert.equal(regla.tipoSancionAuto, null)
    assert.equal(regla.tipoInasistencia, 'TARDANZA')
})
