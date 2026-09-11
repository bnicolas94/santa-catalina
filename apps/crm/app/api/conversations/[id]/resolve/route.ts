import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { canResolveConversation } from '@/lib/conversations/lifecycle'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as { lockToken?: unknown }
    const lockToken = typeof body.lockToken === 'string' ? body.lockToken : null

    const result = await crmPrisma.$transaction(async transaction => {
      const conversation = await transaction.conversation.findUnique({ where: { id } })
      if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
      if (conversation.status === 'ARCHIVED') throw new CrmApiError(409, 'CONVERSATION_ARCHIVED', 'La conversación ya está archivada.')
      if (conversation.status === 'RESOLVED') return { status: conversation.status, resolvedAt: conversation.resolvedAt }
      if (!canResolveConversation(user, conversation, lockToken)) {
        throw new CrmApiError(409, 'LOCK_LOST', 'Sólo el agente que atiende la conversación puede resolverla.')
      }

      const resolvedAt = new Date()
      await transaction.conversation.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt,
          unreadCount: 0,
          activeById: null,
          lockToken: null,
          lockExpiresAt: null,
        },
      })
      await transaction.conversationEvent.create({
        data: { conversationId: id, type: 'CONVERSATION_RESOLVED', actorId: user.id },
      })
      return { status: 'RESOLVED' as const, resolvedAt }
    })

    return NextResponse.json(result)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
