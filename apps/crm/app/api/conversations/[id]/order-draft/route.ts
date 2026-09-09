import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { updateConversationOrderDraft } from '@/lib/conversations/order-draft'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const draft = await updateConversationOrderDraft(crmPrisma, {
      conversationId: id,
      agentId: user.id,
      lockToken: requireText(body.lockToken, 'lockToken', 100),
      orderDate: body.orderDate,
      orderAddress: body.orderAddress,
      orderFulfillment: body.orderFulfillment,
      orderShift: body.orderShift,
    })
    return NextResponse.json({ draft })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
