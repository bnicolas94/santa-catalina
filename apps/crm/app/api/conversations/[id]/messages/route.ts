import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { sendConversationText } from '@/lib/conversations/messages'
import { sortMessagesChronologically } from '@/lib/conversations/message-order'
import { effectiveUnreadCount } from '@/lib/conversations/unread'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const conversation = await crmPrisma.conversation.findFirst({
      where: { id, ...conversationVisibilityWhere(user) },
      select: {
        id: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        lastInboundAt: true,
        lastOutboundAt: true,
        serviceWindowExpiresAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 300 },
      },
    })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    return NextResponse.json({
      ...conversation,
      unreadCount: effectiveUnreadCount(conversation),
      messages: sortMessagesChronologically(conversation.messages),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const message = await sendConversationText(crmPrisma, {
      conversationId: id,
      agentId: user.id,
      lockToken: requireText(body.lockToken, 'lockToken', 100),
      clientMessageId: requireText(body.clientMessageId, 'clientMessageId', 100),
      text: requireText(body.text, 'Mensaje', 4096),
      replyToWaMessageId: body.replyToWaMessageId ? requireText(body.replyToWaMessageId, 'replyToWaMessageId', 200) : null,
    })
    return NextResponse.json({ message })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
