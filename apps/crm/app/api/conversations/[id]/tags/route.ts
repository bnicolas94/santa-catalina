import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const tagId = requireText(body.tagId, 'tagId', 100)
    if (typeof body.selected !== 'boolean') {
      throw new CrmApiError(400, 'VALIDATION_ERROR', 'El estado de la etiqueta no es válido.')
    }

    const tags = await crmPrisma.$transaction(async transaction => {
      const [conversation, tag, current] = await Promise.all([
        transaction.conversation.findFirst({
          where: { id, ...conversationVisibilityWhere(user) },
          select: { id: true },
        }),
        transaction.tag.findFirst({
          where: { id: tagId, active: true },
          select: { id: true, name: true },
        }),
        transaction.conversationTag.findUnique({
          where: { conversationId_tagId: { conversationId: id, tagId } },
          select: { tagId: true },
        }),
      ])
      if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe o no está disponible para este usuario.')
      if (!tag) throw new CrmApiError(404, 'TAG_NOT_FOUND', 'La etiqueta ya no está disponible.')

      const changed = body.selected ? !current : Boolean(current)
      if (body.selected && !current) {
        await transaction.conversationTag.create({
          data: { conversationId: id, tagId, addedById: user.id },
        })
      } else if (!body.selected && current) {
        await transaction.conversationTag.delete({
          where: { conversationId_tagId: { conversationId: id, tagId } },
        })
      }
      if (changed) {
        await transaction.conversationEvent.create({
          data: {
            conversationId: id,
            type: body.selected ? 'TAG_ADDED' : 'TAG_REMOVED',
            actorId: user.id,
            metadata: { tagId, tagName: tag.name },
          },
        })
      }

      const assigned = await transaction.conversationTag.findMany({
        where: { conversationId: id, tag: { active: true } },
        orderBy: { tag: { name: 'asc' } },
        select: { tag: { select: { id: true, name: true, color: true } } },
      })
      return assigned.map(item => item.tag)
    })

    return NextResponse.json({ tags })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
