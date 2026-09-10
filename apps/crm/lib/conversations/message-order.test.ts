import assert from 'node:assert/strict'
import test from 'node:test'
import { sortMessagesChronologically } from './message-order'

test('ordena por la hora real de WhatsApp aunque el historial llegue después', () => {
  const messages = sortMessagesChronologically([
    { id: 'history', providerTimestamp: '2026-09-10T19:10:00.000Z', createdAt: '2026-09-10T19:20:00.000Z' },
    { id: 'live', providerTimestamp: '2026-09-10T19:15:00.000Z', createdAt: '2026-09-10T19:15:02.000Z' },
  ])

  assert.deepEqual(messages.map(message => message.id), ['history', 'live'])
})

test('usa createdAt para mensajes internos sin hora del proveedor', () => {
  const messages = sortMessagesChronologically([
    { id: 'after', providerTimestamp: null, createdAt: '2026-09-10T19:16:00.000Z' },
    { id: 'before', providerTimestamp: '2026-09-10T19:15:00.000Z', createdAt: '2026-09-10T19:20:00.000Z' },
  ])

  assert.deepEqual(messages.map(message => message.id), ['before', 'after'])
})
