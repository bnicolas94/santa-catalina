import assert from 'node:assert/strict'
import test from 'node:test'
import { CrmApiError } from './api'
import { normalizeQuickReplyInput } from './quick-replies'

test('normaliza el atajo y conserva el mensaje estructurado', () => {
  assert.deepEqual(normalizeQuickReplyInput({
    shortcut: ' /Envio_Hoy ',
    title: 'Confirmar envío',
    body: 'Tu envío quedó confirmado.',
  }), {
    shortcut: 'envio_hoy',
    title: 'Confirmar envío',
    body: 'Tu envío quedó confirmado.',
    active: true,
  })
})

test('rechaza atajos con espacios para que funcionen con la barra', () => {
  assert.throws(
    () => normalizeQuickReplyInput({ shortcut: 'envio hoy', title: 'Envío', body: 'Mensaje' }),
    (error: unknown) => error instanceof CrmApiError && error.code === 'INVALID_SHORTCUT',
  )
})

test('permite actualizar sólo el estado usando los datos existentes', () => {
  assert.equal(normalizeQuickReplyInput({ active: false }, {
    shortcut: 'saludo', title: 'Saludo', body: '¡Hola!', active: true,
  }).active, false)
})
