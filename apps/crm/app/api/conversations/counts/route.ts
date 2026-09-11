import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { summarizeConversationCounts } from '@/lib/conversations/unread'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await requireCrmUser(request)
    const conversations = await crmPrisma.conversation.findMany({
      where: { status: { not: 'ARCHIVED' }, ...conversationVisibilityWhere(user) },
      select: {
        status: true,
        assignedToId: true,
        unreadCount: true,
        lastInboundAt: true,
        lastOutboundAt: true,
      },
    })
    return NextResponse.json(summarizeConversationCounts(conversations, user.id))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
