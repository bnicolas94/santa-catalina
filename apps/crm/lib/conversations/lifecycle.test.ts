import assert from 'node:assert/strict'
import test from 'node:test'
import type { CrmSessionUser } from '@santa-catalina/contracts'
import { canArchiveConversation, canResolveConversation } from './lifecycle'

const operator: CrmSessionUser = {
  id: 'agent-a', name: 'Operador A', rol: 'ATENCION', permisos: { permisoAtencion: true },
}
const supervisor: CrmSessionUser = {
  id: 'admin', name: 'Admin', rol: 'ADMIN', permisos: { permisoAtencion: true, permisoAtencionAdmin: true },
}
const activeConversation = {
  assignedToId: 'agent-a', activeById: 'agent-a', lockToken: 'token-a', lockExpiresAt: new Date('2026-09-11T15:05:00.000Z'),
}

test('el operador sólo puede resolver con su lease vigente', () => {
  const now = new Date('2026-09-11T15:00:00.000Z')
  assert.equal(canResolveConversation(operator, activeConversation, 'token-a', now), true)
  assert.equal(canResolveConversation(operator, activeConversation, 'otro-token', now), false)
})

test('supervisión puede resolver sin tomar el chat', () => {
  assert.equal(canResolveConversation(supervisor, activeConversation, null), true)
})

test('sólo el agente asignado o supervisión pueden archivar', () => {
  assert.equal(canArchiveConversation(operator, activeConversation), true)
  assert.equal(canArchiveConversation({ ...operator, id: 'agent-b' }, activeConversation), false)
  assert.equal(canArchiveConversation(supervisor, activeConversation), true)
})
