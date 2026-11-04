import test from 'node:test'
import assert from 'node:assert/strict'
import { prepararVista } from './vista'
import { crearPlan } from './banco.server'
import { respuestaInicial } from './motor'
import type { EstadoPractica, Sesion } from './tipos'

const plan = crearPlan(undefined, 0)
const base: EstadoPractica = { plan, sesiones: {}, ahora: '2026-11-04T12:00:00Z', estado: 'EN_PROGRESO' }
const sesion: Sesion = { inicio: base.ahora, fin: null, pausa: null, pausadoMs: 0, revision: 0, respuesta: respuestaInicial(plan.modulos[0]), historial: [] }

test('recupera el ejercicio cuando se pierde la respuesta del inicio y llega un latido', () => {
    const iniciada = { ...base, ahora: '2026-11-04T12:00:10Z', sesiones: { TIPEO: sesion } }
    const vista = prepararVista(base, iniciada, null)
    assert.equal(vista.hidratar, true)
    assert.deepEqual(vista.respuesta, sesion.respuesta)
})
test('un latido anterior no oculta la prueba que acaba de iniciarse', () => {
    const iniciada = { ...base, ahora: '2026-11-04T12:00:10Z', sesiones: { TIPEO: sesion } }
    assert.equal(prepararVista(iniciada, base, sesion.respuesta).aceptado, false)
    assert.equal(prepararVista(iniciada, { ...base, ahora: iniciada.ahora }, sesion.respuesta).aceptado, false)
})
test('los latidos conservan el texto local pendiente de confirmación', () => {
    const iniciada = { ...base, sesiones: { TIPEO: sesion } }
    const borrador = { ...sesion.respuesta, texto: 'Cambio pendiente de guardar' }
    const vista = prepararVista(iniciada, { ...iniciada, ahora: '2026-11-04T12:00:10Z' }, borrador)
    assert.equal(vista.hidratar, false)
    assert.equal(vista.respuesta, borrador)
})
test('una revisión antigua no reemplaza el ejercicio y continuar limpia el módulo anterior', () => {
    const actual = { ...base, sesiones: { TIPEO: { ...sesion, revision: 2 } } }
    assert.equal(prepararVista(actual, { ...actual, sesiones: { TIPEO: sesion } }, sesion.respuesta).aceptado, false)
    const siguiente = { ...actual, sesiones: { TIPEO: { ...sesion, revision: 3, fin: '2026-11-04T12:00:20Z' } }, ahora: '2026-11-04T12:00:20Z' }
    const vista = prepararVista(actual, siguiente, sesion.respuesta)
    assert.equal(vista.hidratar, true)
    assert.equal(vista.respuesta, null)
})
