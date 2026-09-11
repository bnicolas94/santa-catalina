import assert from 'node:assert/strict'
import test from 'node:test'
import type { CrmSessionUser } from '@santa-catalina/contracts'
import { conversationListWhere, isConversationListView } from './listing'

function agent(): CrmSessionUser {
  return {
    id: 'agent-a',
    nombre: 'Agente A',
    email: 'agente@santacatalina.online',
    rol: 'EMPLEADO',
    permisos: { permisoAtencion: true, permisoAtencionAdmin: false },
  }
}

test('la vista nuevas consulta las conversaciones sin asignar en la base', () => {
  assert.deepEqual(conversationListWhere(agent(), 'unassigned'), {
    AND: [
      { OR: [{ assignedToId: null }, { assignedToId: 'agent-a' }] },
      { status: 'UNASSIGNED' },
    ],
  })
})

test('la vista mías acota por agente y excluye conversaciones cerradas', () => {
  assert.deepEqual(conversationListWhere(agent(), 'mine'), {
    AND: [
      { OR: [{ assignedToId: null }, { assignedToId: 'agent-a' }] },
      { assignedToId: 'agent-a', status: { notIn: ['RESOLVED', 'ARCHIVED'] } },
    ],
  })
})

test('la búsqueda se ejecuta en servidor por nombre, perfil o teléfono', () => {
  const where = conversationListWhere(agent(), 'all', ' Sonia ')
  assert.deepEqual((where.AND as unknown[])[2], {
    contact: {
      OR: [
        { displayName: { contains: 'Sonia', mode: 'insensitive' } },
        { profileName: { contains: 'Sonia', mode: 'insensitive' } },
        { phoneE164: { contains: 'Sonia' } },
      ],
    },
  })
})

test('rechaza vistas desconocidas', () => {
  assert.equal(isConversationListView('waiting'), true)
  assert.equal(isConversationListView('pendientes'), false)
})
