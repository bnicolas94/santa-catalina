import type { CrmSessionUser } from '@santa-catalina/contracts'
import { isCrmSupervisor } from './access'
import { isLeaseOwned } from './locking'

type ConversationLifecycleState = {
  assignedToId: string | null
  activeById: string | null
  lockToken: string | null
  lockExpiresAt: Date | null
}

export function canResolveConversation(
  user: CrmSessionUser,
  conversation: ConversationLifecycleState,
  lockToken: string | null,
  now = new Date(),
) {
  if (isCrmSupervisor(user)) return true
  return Boolean(lockToken && isLeaseOwned(conversation, user.id, lockToken, now))
}

export function canArchiveConversation(user: CrmSessionUser, conversation: Pick<ConversationLifecycleState, 'assignedToId'>) {
  return isCrmSupervisor(user) || conversation.assignedToId === user.id
}
