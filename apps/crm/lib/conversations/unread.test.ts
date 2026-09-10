import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveUnreadCount } from './unread'

test('oculta pendientes antiguos cuando ya existe una respuesta posterior', () => {
  assert.equal(effectiveUnreadCount({
    unreadCount: 9,
    lastInboundAt: '2026-09-10T18:10:00.000Z',
    lastOutboundAt: '2026-09-10T18:13:00.000Z',
  }), 0)
})

test('mantiene pendientes si el cliente volvió a escribir después de la respuesta', () => {
  assert.equal(effectiveUnreadCount({
    unreadCount: 2,
    lastInboundAt: '2026-09-10T18:15:00.000Z',
    lastOutboundAt: '2026-09-10T18:13:00.000Z',
  }), 2)
})

test('mantiene pendientes en una conversación que todavía no fue respondida', () => {
  assert.equal(effectiveUnreadCount({
    unreadCount: 4,
    lastInboundAt: '2026-09-10T18:15:00.000Z',
    lastOutboundAt: null,
  }), 4)
})
