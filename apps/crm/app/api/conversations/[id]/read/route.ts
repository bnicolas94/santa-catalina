import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'
import { markWhatsAppMessageRead } from '@/lib/whatsapp/provider'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const lockToken = requireText(body.lockToken, 'lockToken', 100)

    const result = await crmPrisma.$transaction(async transaction => {
      const conversation = await transaction.conversation.findUnique({
        where: { id },
        select: {
          assignedToId: true,
          activeById: true,
          lockToken: true,
          lockExpiresAt: true,
          updatedAt: true,
          channel: true,
          messages: {
            where: { direction: 'INBOUND', waMessageId: { not: null } },
            orderBy: [
              { providerTimestamp: { sort: 'desc', nulls: 'last' } },
              { createdAt: 'desc' },
            ],
            take: 1,
            select: { waMessageId: true },
          },
        },
      })
      if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
      if (
        conversation.assignedToId !== user.id
        || conversation.activeById !== user.id
        || conversation.lockToken !== lockToken
        || !conversation.lockExpiresAt
        || conversation.lockExpiresAt <= new Date()
      ) {
        throw new CrmApiError(409, 'LOCK_LOST', 'La conversación ya no está activa para este usuario.')
      }

      const updated = await transaction.conversation.updateMany({
        where: { id, updatedAt: conversation.updatedAt, lockToken, activeById: user.id },
        data: { unreadCount: 0 },
      })
      return { updated: updated.count === 1, channel: conversation.channel, waMessageId: conversation.messages[0]?.waMessageId || null }
    })

    if (!result.updated) return NextResponse.json({ read: false, retry: true, providerMarked: false })

    let providerMarked = false
    if (result.waMessageId) {
      try {
        providerMarked = (await markWhatsAppMessageRead(result.channel, result.waMessageId)).providerMarked
      } catch (error) {
        console.error('[CRM WhatsApp read receipt]', error instanceof Error ? error.message : 'Error desconocido')
      }
    }
    return NextResponse.json({ read: true, retry: false, providerMarked })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
