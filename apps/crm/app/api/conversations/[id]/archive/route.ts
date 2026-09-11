import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { canArchiveConversation } from '@/lib/conversations/lifecycle'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params

    await crmPrisma.$transaction(async transaction => {
      const conversation = await transaction.conversation.findUnique({
        where: { id }, select: { status: true, assignedToId: true },
      })
      if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
      if (conversation.status === 'ARCHIVED') return
      if (conversation.status !== 'RESOLVED') {
        throw new CrmApiError(409, 'CONVERSATION_NOT_RESOLVED', 'Primero debés resolver la conversación.')
      }
      if (!canArchiveConversation(user, conversation)) {
        throw new CrmApiError(403, 'FORBIDDEN', 'Sólo el agente asignado o un supervisor pueden archivarla.')
      }

      await transaction.conversation.update({
        where: { id },
        data: { status: 'ARCHIVED', activeById: null, lockToken: null, lockExpiresAt: null },
      })
      await transaction.conversationEvent.create({
        data: { conversationId: id, type: 'CONVERSATION_ARCHIVED', actorId: user.id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
