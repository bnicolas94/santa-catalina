import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const supervisor = await requireCrmUser(request, true)
    const cutoff = new Date()

    const updated = await crmPrisma.$transaction(async transaction => {
      const conversations = await transaction.$queryRaw<Array<{ id: string }>>`
        UPDATE "crm"."conversations"
        SET "unread_count" = 0, "updated_at" = NOW()
        WHERE "unread_count" > 0
          AND "status" NOT IN ('RESOLVED'::"crm"."ConversationStatus", 'ARCHIVED'::"crm"."ConversationStatus")
          AND "updated_at" <= ${cutoff}
        RETURNING "id"
      `

      if (conversations.length > 0) {
        await transaction.conversationEvent.createMany({
          data: conversations.map(conversation => ({
            conversationId: conversation.id,
            type: 'CONVERSATION_BULK_MARKED_READ',
            actorId: supervisor.id,
            metadata: { cutoff: cutoff.toISOString(), source: 'ADMIN_INBOX_ACTION' },
          })),
        })
      }

      return conversations.length
    })

    return NextResponse.json({ updated, cutoff: cutoff.toISOString() })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
