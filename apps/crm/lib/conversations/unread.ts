type ConversationReadState = {
  unreadCount: number
  lastInboundAt: Date | string | null
  lastOutboundAt: Date | string | null
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
