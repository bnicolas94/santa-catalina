import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveUnreadCount, summarizeConversationCounts } from './unread'

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

test('separa el total activo de las conversaciones realmente sin leer', () => {
  const summary = summarizeConversationCounts([
    { status: 'OPEN', assignedToId: 'agent-a', unreadCount: 4, lastInboundAt: '2026-09-11T14:00:00Z', lastOutboundAt: '2026-09-11T13:00:00Z' },
    { status: 'WAITING_CUSTOMER', assignedToId: 'agent-a', unreadCount: 7, lastInboundAt: '2026-09-11T12:00:00Z', lastOutboundAt: '2026-09-11T12:10:00Z' },
    { status: 'UNASSIGNED', assignedToId: null, unreadCount: 2, lastInboundAt: '2026-09-11T15:00:00Z', lastOutboundAt: null },
    { status: 'RESOLVED', assignedToId: 'agent-a', unreadCount: 0, lastInboundAt: null, lastOutboundAt: null },
  ], 'agent-a')

  assert.deepEqual(summary, {
    all: 3,
    mine: 2,
    unassigned: 1,
    waiting: 1,
    resolved: 1,
    unreadConversations: 2,
    unreadMessages: 6,
  })
})
