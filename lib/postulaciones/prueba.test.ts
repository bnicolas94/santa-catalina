import assert from 'node:assert/strict'
import test from 'node:test'
import { validarRespuestas, validarRevision, vencePrueba } from './prueba'
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
