import assert from 'node:assert/strict'
import test from 'node:test'
import { CASOS_WHATSAPP, PEDIDOS, TEXTO_TIPEO, contenidoPrueba, validarRespuestas, validarRevision, vencePrueba } from './prueba'
import { hashToken, tokenNuevo, tokenValido } from './token'

test('el enlace usa un token aleatorio de alta entropía y guarda sólo su hash', () => {
    const token = tokenNuevo()
    assert.equal(tokenValido(token), true)
    assert.equal(hashToken(token).length, 64)
    assert.notEqual(hashToken(token), token)
    assert.notEqual(tokenNuevo(), token)
})

test('la ventana de respuesta se calcula desde el inicio', () => {
    assert.equal(vencePrueba(new Date('2026-11-03T12:00:00Z')).toISOString(), '2026-11-03T12:45:00.000Z')
})

test('rechaza respuestas incompletas o sobredimensionadas', () => {
    assert.throws(() => validarRespuestas({ whatsapp: [] }))
    assert.throws(() => validarRevision({ tipeo: 6, atencion: 5, pedidos: 5, rutas: 5, criterio: 5, observaciones: '' }))
})

test('la invitación anterior conserva sus consignas y la nueva trae un caso general autocontenido', () => {
    const anterior = contenidoPrueba(1)
    const general = contenidoPrueba(2)
    assert.equal(anterior.textoTipeo, TEXTO_TIPEO)
    assert.deepEqual(anterior.casosWhatsapp, CASOS_WHATSAPP)
    assert.deepEqual(anterior.pedidos, PEDIDOS)
    assert.equal(general.casosWhatsapp.length, anterior.casosWhatsapp.length)
    assert.equal(general.pedidos.length, anterior.pedidos.length)
    assert.match(general.introduccion, /No necesitás conocer Santa Catalina/)
    assert.match(general.referencia, /lunes 9 de noviembre de 2026/)
    assert.doesNotMatch(general.textoTipeo, /Clásico|Veggie|Especial/)
})
