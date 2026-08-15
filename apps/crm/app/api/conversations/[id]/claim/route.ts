import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { claimConversation } from '@/lib/conversations/locking'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const lock = await crmPrisma.$transaction(async transaction => {
      const previouslyAssigned = await transaction.conversation.findUnique({
        where: { id }, select: { assignedToId: true },
      })
      const acquired = await claimConversation(transaction, id, user.id)
      if (!previouslyAssigned?.assignedToId) {
        await transaction.conversationAssignment.create({
          data: { conversationId: id, toAgentId: user.id, action: 'ASSIGNED', performedById: user.id },
        })
        await transaction.conversationEvent.create({
          data: { conversationId: id, type: 'CONVERSATION_CLAIMED', actorId: user.id },
        })
      }
      return acquired
    })
    return NextResponse.json({ lock })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
