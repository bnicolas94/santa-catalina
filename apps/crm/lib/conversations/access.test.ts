import assert from 'node:assert/strict'
import test from 'node:test'
import type { CrmSessionUser } from '@santa-catalina/contracts'
import { conversationVisibilityWhere, isCrmSupervisor } from './access'

function agent(overrides: Partial<CrmSessionUser> = {}): CrmSessionUser {
  return {
    id: 'agent-a',
    name: 'Operador A',
    rol: 'ATENCION',
    permisos: { permisoAtencion: true },
    ...overrides,
  }
}

test('un operador sólo recibe conversaciones propias o sin asignar', () => {
  assert.deepEqual(conversationVisibilityWhere(agent()), {
    OR: [
      { assignedToId: null },
      { assignedToId: 'agent-a' },
    ],
  })
})

test('ADMIN puede consultar todas las conversaciones', () => {
  const user = agent({ rol: 'ADMIN' })
  assert.equal(isCrmSupervisor(user), true)
  assert.deepEqual(conversationVisibilityWhere(user), {})
})

test('el permiso de supervisión también habilita la vista completa', () => {
  const user = agent({ permisos: { permisoAtencion: true, permisoAtencionAdmin: true } })
  assert.equal(isCrmSupervisor(user), true)
  assert.deepEqual(conversationVisibilityWhere(user), {})
})
