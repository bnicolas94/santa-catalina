import assert from 'node:assert/strict'
import test from 'node:test'
import { CONSULTAS_CLIENTES, FILAS_CONTROL, TEXTO_TIPEO_V3, metricasErrores, metricasTipeo, validarRespuestasV3 } from './habilidades'

test('control de errores distingue diferencias reales de falsas alarmas', () => {
    const respuestas = validarRespuestasV3({
        errores: ['R1', 'R2', 'R4', 'R6', 'R8'].map(id => ({ id, correccion: 'Revisar campo' })),
        clientes: CONSULTAS_CLIENTES.map(() => 'Respuesta de ejemplo'),
    })
    assert.equal(FILAS_CONTROL.length, 8)
    assert.deepEqual(metricasErrores(respuestas), { detectadas: 4, erroresReales: 4, falsasAlarmas: 1, omitidas: 0 })
    assert.throws(() => validarRespuestasV3({ ...respuestas, errores: [{ id: 'R2', correccion: 'a' }, { id: 'R2', correccion: 'b' }] }))
    assert.throws(() => validarRespuestasV3({ ...respuestas, errores: [{ id: 'R9', correccion: 'a' }] }))
    assert.throws(() => validarRespuestasV3({ ...respuestas, errores: [{ id: 'R2', correccion: '' }] }))
})

test('velocidad y precisión usan el tiempo y texto efectivos', () => {
    const inicio = new Date('2026-11-03T12:00:00Z')
    const fin = new Date('2026-11-03T12:02:00Z')
    const exacto = metricasTipeo(TEXTO_TIPEO_V3, inicio, fin)
    assert.equal(exacto?.segundos, 120)
    assert.equal(exacto?.exactitud, 100)
    assert.ok((exacto?.palabrasNetasPorMinuto || 0) > 0)
    assert.ok((metricasTipeo('texto distinto', inicio, fin)?.exactitud || 0) < 100)
})
