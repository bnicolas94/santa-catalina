import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCrmUser(request)
    const { id } = await context.params
    const conversation = await crmPrisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        channel: { select: { id: true, name: true, displayPhoneNumber: true, connectionStatus: true } },
        messages: { orderBy: [{ providerTimestamp: 'asc' }, { createdAt: 'asc' }], take: 300 },
        tags: { include: { tag: true } },
        assignments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    return NextResponse.json({
      ...conversation,
      tags: conversation.tags.map(item => item.tag),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
