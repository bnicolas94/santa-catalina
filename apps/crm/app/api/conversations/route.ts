import { NextRequest, NextResponse } from 'next/server'
import { crmPrisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api'
import { requireCrmUser } from '@/lib/session'
import type { ConversationStatus, Prisma } from '@/generated/prisma'

const ALLOWED_STATUSES = new Set<ConversationStatus>(['UNASSIGNED', 'OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'ARCHIVED'])

export async function GET(request: NextRequest) {
  try {
    const user = await requireCrmUser(request)
    const statusParam = request.nextUrl.searchParams.get('status')?.toUpperCase()
    const assigned = request.nextUrl.searchParams.get('assigned')
    const search = request.nextUrl.searchParams.get('q')?.trim()
    const where: Prisma.ConversationWhereInput = {}

    if (statusParam && ALLOWED_STATUSES.has(statusParam as ConversationStatus)) {
      where.status = statusParam as ConversationStatus
    }
    if (assigned === 'me') where.assignedToId = user.id
    if (assigned === 'unassigned') where.assignedToId = null
    if (search) {
      where.OR = [
        { contact: { displayName: { contains: search, mode: 'insensitive' } } },
        { contact: { phoneE164: { contains: search } } },
      ]
    }

    const conversations = await crmPrisma.conversation.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
      take: 100,
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
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
      unreadCount: conversation.unreadCount,
      lastMessageAt: conversation.lastMessageAt,
      serviceWindowExpiresAt: conversation.serviceWindowExpiresAt,
      contact: conversation.contact,
      tags: conversation.tags.map(item => item.tag),
      lastMessage: conversation.messages[0] || null,
    })))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
