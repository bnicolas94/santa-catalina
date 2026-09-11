import type { CrmSessionUser } from '@santa-catalina/contracts'
import type { Prisma } from '@/generated/prisma'
import { conversationVisibilityWhere } from './access'

export const CONVERSATION_LIST_VIEWS = ['all', 'mine', 'unassigned', 'waiting', 'resolved'] as const

export type ConversationListView = typeof CONVERSATION_LIST_VIEWS[number]

export function isConversationListView(value: string | null): value is ConversationListView {
  return CONVERSATION_LIST_VIEWS.includes(value as ConversationListView)
}

export function conversationListWhere(
  user: CrmSessionUser,
  view: ConversationListView,
  search?: string | null,
): Prisma.ConversationWhereInput {
  const constraints: Prisma.ConversationWhereInput[] = [conversationVisibilityWhere(user)]

  if (view === 'all') constraints.push({ status: { notIn: ['RESOLVED', 'ARCHIVED'] } })
  if (view === 'mine') constraints.push({ assignedToId: user.id, status: { notIn: ['RESOLVED', 'ARCHIVED'] } })
  if (view === 'unassigned') constraints.push({ status: 'UNASSIGNED' })
  if (view === 'waiting') constraints.push({ status: 'WAITING_CUSTOMER' })
  if (view === 'resolved') constraints.push({ status: 'RESOLVED' })

  const term = search?.trim()
  if (term) {
    constraints.push({
      contact: {
        OR: [
          { displayName: { contains: term, mode: 'insensitive' } },
          { profileName: { contains: term, mode: 'insensitive' } },
          { phoneE164: { contains: term } },
        ],
      },
    })
  }

  return { AND: constraints }
}
