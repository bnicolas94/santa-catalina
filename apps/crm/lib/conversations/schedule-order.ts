import type { PrismaClient } from '@/generated/prisma'
import { CrmApiError } from '../api'
import { isLeaseOwned } from './locking'
import { isOrderDraftComplete, normalizeOrderDraft } from './order-draft'

const draftSelect = {
  orderDate: true,
  orderAddress: true,
  orderFulfillment: true,
  orderPickupLocationId: true,
  orderPickupLocationName: true,
  orderShift: true,
  orderDraftUpdatedById: true,
  orderDraftUpdatedAt: true,
} as const

export function scheduledOrderSnapshot(input: Parameters<typeof normalizeOrderDraft>[0]) {
  const draft = normalizeOrderDraft(input)
  if (!isOrderDraftComplete(draft)) {
    throw new CrmApiError(400, 'ORDER_DRAFT_INCOMPLETE', 'Completá fecha, modalidad, destino y turno antes de marcar el pedido como agendado.')
  }
  return {
    orderDate: draft.orderDate!,
    orderAddress: draft.orderAddress,
    orderFulfillment: draft.orderFulfillment!,
    orderPickupLocationId: draft.orderPickupLocationId,
    orderPickupLocationName: draft.orderPickupLocationName,
    orderShift: draft.orderShift!,
  }
}

export async function scheduleConversationOrder(prisma: PrismaClient, input: {
  conversationId: string
  agentId: string
  lockToken: string
  clientActionId: string
}) {
  return prisma.$transaction(async transaction => {
    await transaction.$queryRaw`
      SELECT "id" FROM "crm"."conversations"
      WHERE "id" = ${input.conversationId}
      FOR UPDATE
    `
    const conversation = await transaction.conversation.findUnique({ where: { id: input.conversationId } })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    const existing = await transaction.scheduledOrder.findUnique({ where: { clientActionId: input.clientActionId } })
    if (existing) {
      if (existing.conversationId !== conversation.id || existing.scheduledById !== input.agentId) {
        throw new CrmApiError(409, 'ACTION_ID_CONFLICT', 'La identificación de esta operación ya fue utilizada.')
      }
      const currentDraft = await transaction.conversation.findUniqueOrThrow({
        where: { id: conversation.id },
        select: draftSelect,
      })
      return { scheduledOrder: existing, draft: currentDraft }
    }

    if (conversation.status === 'RESOLVED' || conversation.status === 'ARCHIVED') {
      throw new CrmApiError(409, 'CONVERSATION_CLOSED', 'La conversación está cerrada.')
    }
    if (!isLeaseOwned(conversation, input.agentId, input.lockToken)) {
      throw new CrmApiError(409, 'LOCK_LOST', 'No podés agendar el pedido porque el control de la conversación venció o pertenece a otra persona.')
    }

    const snapshot = scheduledOrderSnapshot(conversation)
    const scheduledOrder = await transaction.scheduledOrder.create({
      data: {
        conversationId: conversation.id,
        clientActionId: input.clientActionId,
        ...snapshot,
        scheduledById: input.agentId,
      },
    })
    const updatedAt = new Date()
    const draft = await transaction.conversation.update({
      where: { id: conversation.id },
      data: {
        orderDate: null,
        orderAddress: null,
        orderFulfillment: null,
        orderPickupLocationId: null,
        orderPickupLocationName: null,
        orderShift: null,
        orderDraftUpdatedById: input.agentId,
        orderDraftUpdatedAt: updatedAt,
      },
      select: draftSelect,
    })
    await transaction.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: 'ORDER_SCHEDULED_EXTERNALLY',
        actorId: input.agentId,
        metadata: {
          scheduledOrderId: scheduledOrder.id,
          orderDate: scheduledOrder.orderDate,
          fulfillment: scheduledOrder.orderFulfillment,
          pickupLocationId: scheduledOrder.orderPickupLocationId,
        },
      },
    })
    return { scheduledOrder, draft }
  })
}
