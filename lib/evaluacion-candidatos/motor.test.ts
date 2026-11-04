import test from 'node:test'
import assert from 'node:assert/strict'
import { CONFIG_INICIAL, crearPlan } from './banco.server'
import { guardarSesion, metricasTipeo, planPublico, respuestaInicial, tiempoActivo, validarConfig, validarRespuesta, validarLease } from './motor'
import { filasVisibles, valorCelda, VISTA_INICIAL } from './planilla'
import type { Sesion } from './tipos'
const inicio = Date.parse('2026-11-04T15:00:00Z')
const plan = crearPlan(CONFIG_INICIAL, 0)
test('sólo una sesión puede escribir y la recuperación exige adquirir el lease', () => {
    assert.throws(() => validarLease('a', new Date(inicio + 45000), 'b', true, inicio), /otra sesión/)
    assert.doesNotThrow(() => validarLease('a', new Date(inicio + 45000), 'a', false, inicio))
    assert.throws(() => validarLease('a', new Date(inicio - 1), 'b', false, inicio), /Recuperá/)
    assert.doesNotThrow(() => validarLease('a', new Date(inicio - 1), 'b', true, inicio))
})
const sesion = (i: number): Sesion => ({ inicio: new Date(inicio).toISOString(), fin: null, pausa: null, pausadoMs: 0, revision: 0, respuesta: respuestaInicial(plan.modulos[i]), historial: [] })

test('el banco tiene cinco módulos, doce conversaciones y tiempos de 27 minutos', () => {
    assert.equal(plan.modulos.length, 5)
    assert.equal(plan.modulos[2].ejercicios.length, 12)
    assert.equal(plan.modulos.reduce((s, a) => s + a.segundos, 0), 27 * 60)
    const copia = structuredClone(plan)
    const config = structuredClone(CONFIG_INICIAL); config[0].segundos = 900
    crearPlan(config, 1)
    assert.deepEqual(plan, copia)
    assert.notEqual(plan.modulos[0].ejercicios[0].texto, crearPlan(CONFIG_INICIAL, 1).modulos[0].ejercicios[0].texto)
})
test('métricas de tipeo usan cinco caracteres por palabra y distancia de edición', () => {
    const m = metricasTipeo('Hola mundo', 'Hola mundo', 60000)
    assert.equal(m.ppm, 2); assert.equal(m.cpm, 10); assert.equal(m.exactitud, 100)
    assert.equal(metricasTipeo('casa', 'cosa', 10000).errores, 1)
    assert.equal(metricasTipeo('casa', 'csa', 10000).errores, 1)
})
test('guardado, recuperación, control de versiones y cierre de tipeo', () => {
    const a = plan.modulos[0], s = sesion(0)
    const guardada = guardarSesion(s, a, { ...s.respuesta, texto: 'Texto parcial' }, 0, false, inicio + 10000)
    assert.equal(guardada.revision, 1)
    assert.equal(JSON.parse(JSON.stringify(guardada)).respuesta.texto, 'Texto parcial')
    assert.throws(() => guardarSesion(guardada, a, guardada.respuesta, 0, false, inicio + 12000), /versión/)
    const fin = guardarSesion(guardada, a, guardada.respuesta, 1, true, inicio + 20000)
    assert.equal(fin.metricas?.segundos, 20)
    assert.throws(() => guardarSesion(fin, a, fin.respuesta, 2, false), /cerrado/)
    assert.deepEqual(guardarSesion(fin, a, fin.respuesta, 1, true), fin)
})
test('el reloj sobrevive recargas, cierra en el límite y bloquea fuera de tolerancia', () => {
    const a = plan.modulos[1], s = sesion(1)
    assert.equal(tiempoActivo(JSON.parse(JSON.stringify(s)), inicio + 45000), 45000)
    assert.ok(guardarSesion(s, a, s.respuesta, 0, false, inicio + 301000).fin)
    assert.throws(() => guardarSesion(s, a, s.respuesta, 0, true, inicio + 361000), /tolerancia/)
    assert.throws(() => guardarSesion({ ...s, pausa: new Date(inicio).toISOString() }, a, s.respuesta, 0, false), /pausado/)
})
test('la planilla conserva identidad de filas al filtrar y ordenar', () => {
    const filas = [['A', '3'], ['B', '12'], ['A', '5']]
    const vista = { ...VISTA_INICIAL, columna: 0, filtro: 'A', orden: 1, descendente: true }
    assert.deepEqual(filasVisibles(filas, vista).map(f => f.indice), [2, 0])
    assert.equal(valorCelda('=3*120', filas), 360)
    assert.equal(valorCelda('=SUMA(B1:B3)', filas), 20)
    assert.equal(valorCelda('=fetch("secreto")', filas), null)
})
test('los pedidos mantienen filas separadas y registran correcciones', () => {
    const a = plan.modulos[2], s = sesion(2), r = structuredClone(s.respuesta)
    r.tablas.pedidos[2][3] = '3'
    const primero = guardarSesion(s, a, r, 0, false, inicio + 1000)
    const corregida = structuredClone(primero.respuesta); corregida.tablas.pedidos[2][3] = '5'
    const segundo = guardarSesion(primero, a, corregida, 1, false, inicio + 40000)
    assert.equal(segundo.respuesta.tablas.pedidos[1][3], '')
    assert.match(segundo.historial.at(-1)!.detalle, /3 → 5/)
})
test('los eventos temporizados se reconstruyen sin duplicación y sin soluciones públicas', () => {
    const s = sesion(2)
    s.respuesta.tablas.pedidos[8][3] = '3'
    const antes = planPublico(plan, { CONVERSACIONES: s }, inicio + 10000)
    const despues = planPublico(plan, { CONVERSACIONES: s }, inicio + 100000)
    assert.equal(antes.modulos[2].ejercicios[8].mensajes?.length, 1)
    assert.equal(despues.modulos[2].ejercicios[8].mensajes?.length, 2)
    assert.deepEqual(despues, planPublico(plan, { CONVERSACIONES: s }, inicio + 100000))
    assert.equal('soluciones' in despues, false)
})
test('atención al detalle y redacción se guardan y se bloquean al cerrar', () => {
    for (const i of [3, 4]) {
        const a = plan.modulos[i], s = sesion(i), r = structuredClone(s.respuesta)
        r.textos[a.ejercicios[0].id] = 'Respuesta propuesta'
        if (i === 3) r.marcas = ['D1']
        const cerrada = guardarSesion(s, a, r, 0, true, inicio + 10000)
        assert.equal(cerrada.respuesta.textos[a.ejercicios[0].id], 'Respuesta propuesta')
        assert.throws(() => guardarSesion(cerrada, a, r, 1, false), /cerrado/)
    }
})
test('se rechazan respuestas de otro módulo y configuraciones incoherentes', () => {
    const r = respuestaInicial(plan.modulos[1]); r.tablas.otro = [['dato']]
    assert.throws(() => validarRespuesta(r, plan.modulos[1]))
    assert.throws(() => validarConfig(CONFIG_INICIAL.map(c => ({ ...c, activo: false }))))
    assert.throws(() => validarConfig(CONFIG_INICIAL.map(c => ({ ...c, segundos: 0 }))))
})
