import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { scheduleConversationOrder } from '@/lib/conversations/schedule-order'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const result = await scheduleConversationOrder(crmPrisma, {
      conversationId: id,
      agentId: user.id,
      lockToken: requireText(body.lockToken, 'lockToken', 100),
      clientActionId: requireText(body.clientActionId, 'clientActionId', 80),
    })
    return NextResponse.json({
      ...result,
      scheduledOrder: { ...result.scheduledOrder, scheduledByName: user.name },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
