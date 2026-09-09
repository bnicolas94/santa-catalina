import type { OrderFulfillment, OrderShift, PrismaClient } from '@/generated/prisma'
import { CrmApiError } from '../api'
import { isLeaseOwned } from './locking'

const FULFILLMENT = new Set<OrderFulfillment>(['DELIVERY', 'PICKUP'])
const SHIFTS = new Set<OrderShift>(['MORNING', 'SIESTA', 'AFTERNOON'])

function optionalText(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (normalized.length > maxLength) throw new CrmApiError(400, 'VALIDATION_ERROR', `${field} supera el máximo de ${maxLength} caracteres.`)
  return normalized || null
}

export function normalizeOrderDraft(input: {
  orderDate?: unknown
  orderAddress?: unknown
  orderFulfillment?: unknown
  orderShift?: unknown
}) {
  const orderDate = optionalText(input.orderDate, 'Fecha', 10)
  if (orderDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(orderDate)
    const parsed = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
    if (!match || !parsed || parsed.toISOString().slice(0, 10) !== orderDate) {
      throw new CrmApiError(400, 'INVALID_ORDER_DATE', 'La fecha debe ser una fecha calendario válida.')
    }
  }
  const orderAddress = optionalText(input.orderAddress, 'Dirección', 300)
  const fulfillmentValue = optionalText(input.orderFulfillment, 'Modalidad', 20)
  const shiftValue = optionalText(input.orderShift, 'Turno', 20)
  if (fulfillmentValue && !FULFILLMENT.has(fulfillmentValue as OrderFulfillment)) {
    throw new CrmApiError(400, 'INVALID_FULFILLMENT', 'Elegí Envío o Retiro.')
  }
  if (shiftValue && !SHIFTS.has(shiftValue as OrderShift)) {
    throw new CrmApiError(400, 'INVALID_ORDER_SHIFT', 'Elegí Mañana, Siesta o Tarde.')
  }
  return {
    orderDate,
    orderAddress,
    orderFulfillment: fulfillmentValue as OrderFulfillment | null,
    orderShift: shiftValue as OrderShift | null,
  }
}

export function isOrderDraftComplete(draft: ReturnType<typeof normalizeOrderDraft>) {
  return Boolean(
    draft.orderDate
    && draft.orderFulfillment
    && draft.orderShift
    && (draft.orderFulfillment === 'PICKUP' || draft.orderAddress),
  )
}

export async function updateConversationOrderDraft(prisma: PrismaClient, input: {
  conversationId: string
  agentId: string
  lockToken: string
  orderDate?: unknown
  orderAddress?: unknown
  orderFulfillment?: unknown
  orderShift?: unknown
}) {
  const draft = normalizeOrderDraft(input)
  return prisma.$transaction(async transaction => {
    await transaction.$queryRaw`
      SELECT "id" FROM "crm"."conversations"
      WHERE "id" = ${input.conversationId}
      FOR UPDATE
    `
    const conversation = await transaction.conversation.findUnique({ where: { id: input.conversationId } })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
    if (conversation.status === 'RESOLVED' || conversation.status === 'ARCHIVED') {
      throw new CrmApiError(409, 'CONVERSATION_CLOSED', 'La conversación está cerrada.')
    }
    if (!isLeaseOwned(conversation, input.agentId, input.lockToken)) {
      throw new CrmApiError(409, 'LOCK_LOST', 'No podés editar el pedido porque el control de la conversación venció o pertenece a otra persona.')
    }
    const updatedAt = new Date()
    const updated = await transaction.conversation.update({
      where: { id: conversation.id },
      data: { ...draft, orderDraftUpdatedById: input.agentId, orderDraftUpdatedAt: updatedAt },
      select: {
        orderDate: true,
        orderAddress: true,
        orderFulfillment: true,
        orderShift: true,
        orderDraftUpdatedById: true,
        orderDraftUpdatedAt: true,
      },
    })
    await transaction.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: 'ORDER_DRAFT_UPDATED',
        actorId: input.agentId,
        metadata: { complete: isOrderDraftComplete(draft) },
      },
    })
    return updated
  })
}
