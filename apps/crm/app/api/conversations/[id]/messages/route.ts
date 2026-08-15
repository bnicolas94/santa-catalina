import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { sendConversationText } from '@/lib/conversations/messages'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

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
