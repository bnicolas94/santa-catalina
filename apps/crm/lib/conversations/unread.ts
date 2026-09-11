type ConversationReadState = {
  unreadCount: number
  lastInboundAt: Date | string | null
  lastOutboundAt: Date | string | null
}

type CountableConversation = ConversationReadState & {
  status: 'UNASSIGNED' | 'OPEN' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'ARCHIVED'
  assignedToId: string | null
}

function timestamp(value: Date | string | null) {
  if (!value) return null
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(result) ? result : null
}

/**
 * Evita mostrar pendientes históricos cuando la conversación ya fue respondida.
 * El contador vuelve a ser visible apenas ingresa un mensaje posterior a la respuesta.
 */
export function effectiveUnreadCount(state: ConversationReadState) {
  const unreadCount = Math.max(0, Math.trunc(state.unreadCount))
  if (unreadCount === 0) return 0

  const lastInboundAt = timestamp(state.lastInboundAt)
  const lastOutboundAt = timestamp(state.lastOutboundAt)
  if (lastOutboundAt !== null && (lastInboundAt === null || lastOutboundAt >= lastInboundAt)) return 0

  return unreadCount
}

export function summarizeConversationCounts(conversations: CountableConversation[], userId: string) {
  const active = conversations.filter(item => item.status !== 'RESOLVED' && item.status !== 'ARCHIVED')
  const unread = active.map(effectiveUnreadCount)
  return {
    all: active.length,
    mine: active.filter(item => item.assignedToId === userId).length,
    unassigned: active.filter(item => item.status === 'UNASSIGNED').length,
    waiting: active.filter(item => item.status === 'WAITING_CUSTOMER').length,
    resolved: conversations.filter(item => item.status === 'RESOLVED').length,
    unreadConversations: unread.filter(count => count > 0).length,
    unreadMessages: unread.reduce((total, count) => total + count, 0),
  }
}
