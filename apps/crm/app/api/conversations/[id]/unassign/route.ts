import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supervisor = await requireCrmUser(request, true)
    const { id } = await context.params

    await crmPrisma.$transaction(async transaction => {
      const conversation = await transaction.conversation.findUnique({
        where: { id },
        select: { id: true, assignedToId: true, status: true },
      })
      if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
      if (conversation.status === 'RESOLVED' || conversation.status === 'ARCHIVED') {
        throw new CrmApiError(409, 'CONVERSATION_CLOSED', 'No se puede liberar una conversación cerrada.')
      }
      if (!conversation.assignedToId) return

      await transaction.conversation.update({
        where: { id },
        data: {
          status: 'UNASSIGNED',
          assignedToId: null,
          activeById: null,
          lockToken: null,
          lockExpiresAt: null,
        },
      })
      await transaction.conversationAssignment.create({
        data: {
          conversationId: id,
          fromAgentId: conversation.assignedToId,
          toAgentId: null,
          action: 'FORCE_RELEASED',
          reason: 'Liberada desde la supervisión de Atención',
          performedById: supervisor.id,
        },
      })
      await transaction.conversationEvent.create({
        data: {
          conversationId: id,
          type: 'CONVERSATION_FORCE_RELEASED',
          actorId: supervisor.id,
          metadata: { previousAgentId: conversation.assignedToId },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
