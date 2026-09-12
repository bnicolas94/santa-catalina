import { NextRequest, NextResponse } from 'next/server'
import { crmPrisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api'
import { requireCrmUser } from '@/lib/session'
import { conversationListWhere, isConversationListView } from '@/lib/conversations/listing'
import { effectiveUnreadCount } from '@/lib/conversations/unread'

export async function GET(request: NextRequest) {
  try {
    const user = await requireCrmUser(request)
    const viewParam = request.nextUrl.searchParams.get('view')
    const view = isConversationListView(viewParam) ? viewParam : 'all'
    const search = request.nextUrl.searchParams.get('q')?.trim()

    const conversations = await crmPrisma.conversation.findMany({
      where: conversationListWhere(user, view, search),
      orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
      include: {
        contact: true,
        messages: {
          where: { direction: { not: 'INTERNAL' } },
          orderBy: [
            { providerTimestamp: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
          ],
          take: 1,
        },
        tags: { include: { tag: true } },
      },
    })

    return NextResponse.json(conversations.map(conversation => ({
      id: conversation.id,
      status: conversation.status,
      priority: conversation.priority,
      assignedToId: conversation.assignedToId,
      activeById: conversation.activeById,
      lockExpiresAt: conversation.lockExpiresAt,
      unreadCount: effectiveUnreadCount(conversation),
      lastMessageAt: conversation.lastMessageAt,
      serviceWindowExpiresAt: conversation.serviceWindowExpiresAt,
      contact: conversation.contact,
      tags: conversation.tags.map(item => item.tag),
      lastMessage: conversation.messages[0] ? { ...conversation.messages[0], mediaUrl: undefined } : null,
    })))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
