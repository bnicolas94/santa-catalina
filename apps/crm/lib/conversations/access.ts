import type { CrmSessionUser } from '@santa-catalina/contracts'
import type { Prisma } from '@/generated/prisma'

export function isCrmSupervisor(user: CrmSessionUser) {
  return user.rol === 'ADMIN' || user.permisos.permisoAtencionAdmin === true
}

export function conversationVisibilityWhere(user: CrmSessionUser): Prisma.ConversationWhereInput {
  if (isCrmSupervisor(user)) return {}

  return {
    OR: [
      { assignedToId: null },
      { assignedToId: user.id },
    ],
  }
}
