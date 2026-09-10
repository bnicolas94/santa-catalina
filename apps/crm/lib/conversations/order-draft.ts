import type { CrmOrderItem, ErpProductCatalogItem } from '@santa-catalina/contracts'
import type { OrderFulfillment, OrderShift, Prisma, PrismaClient } from '@/generated/prisma'
import { CrmApiError } from '../api'
import { isLeaseOwned } from './locking'

const FULFILLMENT = new Set<OrderFulfillment>(['DELIVERY', 'PICKUP'])
const SHIFTS = new Set<OrderShift>(['MORNING', 'SIESTA', 'AFTERNOON'])

function optionalText(value: unknown, field: string, maxLength: number) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (normalized.length > maxLength) throw new CrmApiError(400, 'VALIDATION_ERROR', `${field} supera el máximo de ${maxLength} caracteres.`)
  return normalized || null
}

function orderItemSelections(value: unknown) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new CrmApiError(400, 'INVALID_ORDER_ITEMS', 'El detalle del pedido debe ser una lista.')
  if (value.length > 20) throw new CrmApiError(400, 'ORDER_ITEMS_LIMIT', 'La ficha admite hasta 20 productos distintos.')
  const seen = new Set<string>()
  return value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new CrmApiError(400, 'INVALID_ORDER_ITEM', `El producto ${index + 1} no es válido.`)
    const item = raw as Record<string, unknown>
    const presentationId = optionalText(item.presentationId, 'Presentación', 80)
    const quantity = Number(item.quantity)
    if (!presentationId || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new CrmApiError(400, 'INVALID_ORDER_ITEM', `Revisá la presentación y cantidad del producto ${index + 1}.`)
    }
    if (seen.has(presentationId)) throw new CrmApiError(400, 'DUPLICATE_ORDER_ITEM', 'Una presentación no puede repetirse en la ficha.')
    seen.add(presentationId)
    return { presentationId, quantity }
  })
}

export function orderItemSelectionKey(value: unknown) {
  return JSON.stringify(orderItemSelections(value).sort((a, b) => a.presentationId.localeCompare(b.presentationId)))
}

export function canonicalizeOrderItems(value: unknown, catalog: ErpProductCatalogItem[]): CrmOrderItem[] {
  const presentations = new Map(catalog.flatMap(product => product.presentations.map(presentation => [presentation.id, { product, presentation }] as const)))
  return orderItemSelections(value).map(selection => {
    const match = presentations.get(selection.presentationId)
    if (!match) throw new CrmApiError(400, 'ORDER_PRESENTATION_UNAVAILABLE', 'Uno de los productos ya no está disponible en el ERP.')
    return {
      productId: match.product.id,
      presentationId: match.presentation.id,
      productName: match.product.name,
      productCode: match.product.code,
      unitsPerPackage: match.presentation.unitsPerPackage,
      quantity: selection.quantity,
    }
  })
}

export function normalizeStoredOrderItems(value: unknown): CrmOrderItem[] {
  const selections = orderItemSelections(value)
  const source = value as Array<Record<string, unknown>>
  return selections.map((selection, index) => {
    const raw = source[index]
    const productId = optionalText(raw.productId, 'Producto', 80)
    const productName = optionalText(raw.productName, 'Nombre del producto', 160)
    const productCode = optionalText(raw.productCode, 'Código del producto', 80)
    const unitsPerPackage = Number(raw.unitsPerPackage)
    if (!productId || !productName || !productCode || !Number.isInteger(unitsPerPackage) || unitsPerPackage < 1 || unitsPerPackage > 10000) {
      throw new CrmApiError(400, 'INVALID_ORDER_ITEM', `El producto ${index + 1} no tiene una referencia válida.`)
    }
    return { productId, productName, productCode, unitsPerPackage, ...selection }
  })
}

export function normalizeOrderDraft(input: {
  orderDate?: unknown
  orderAddress?: unknown
  orderFulfillment?: unknown
  orderPickupLocationId?: unknown
  orderPickupLocationName?: unknown
  orderShift?: unknown
  orderPaid?: unknown
  orderItems?: unknown
  orderNotes?: unknown
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
  const pickupLocationId = optionalText(input.orderPickupLocationId, 'Local de retiro', 80)
  const pickupLocationName = optionalText(input.orderPickupLocationName, 'Nombre del local de retiro', 160)
  const shiftValue = optionalText(input.orderShift, 'Turno', 20)
  const orderItems = normalizeStoredOrderItems(input.orderItems)
  const orderNotes = optionalText(input.orderNotes, 'Observaciones', 500)
  if (input.orderPaid !== undefined && typeof input.orderPaid !== 'boolean') {
    throw new CrmApiError(400, 'INVALID_PAYMENT_STATUS', 'El estado de pago debe ser válido.')
  }
  if (fulfillmentValue && !FULFILLMENT.has(fulfillmentValue as OrderFulfillment)) {
    throw new CrmApiError(400, 'INVALID_FULFILLMENT', 'Elegí Envío o Retiro.')
  }
  if (shiftValue && !SHIFTS.has(shiftValue as OrderShift)) {
    throw new CrmApiError(400, 'INVALID_ORDER_SHIFT', 'Elegí Mañana, Siesta o Tarde.')
  }
  return {
    orderDate,
    orderAddress: fulfillmentValue === 'PICKUP' ? null : orderAddress,
    orderFulfillment: fulfillmentValue as OrderFulfillment | null,
    orderPickupLocationId: fulfillmentValue === 'PICKUP' ? pickupLocationId : null,
    orderPickupLocationName: fulfillmentValue === 'PICKUP' ? pickupLocationName : null,
    orderShift: shiftValue as OrderShift | null,
    orderPaid: input.orderPaid === true,
    orderItems,
    orderNotes,
  }
}

export function isOrderDraftComplete(draft: ReturnType<typeof normalizeOrderDraft>) {
  return Boolean(
    draft.orderDate
    && draft.orderFulfillment
    && draft.orderShift
    && draft.orderItems.length > 0
    && (draft.orderFulfillment === 'PICKUP'
      ? draft.orderPickupLocationId && draft.orderPickupLocationName
      : draft.orderAddress),
  )
}

export async function updateConversationOrderDraft(prisma: PrismaClient, input: {
  conversationId: string
  agentId: string
  lockToken: string
  orderDate?: unknown
  orderAddress?: unknown
  orderFulfillment?: unknown
  orderPickupLocationId?: unknown
  orderPickupLocationName?: unknown
  orderShift?: unknown
  orderPaid?: unknown
  orderItems?: unknown
  orderNotes?: unknown
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
      data: { ...draft, orderItems: draft.orderItems as unknown as Prisma.InputJsonValue, orderDraftUpdatedById: input.agentId, orderDraftUpdatedAt: updatedAt },
      select: {
        orderDate: true,
        orderAddress: true,
        orderFulfillment: true,
        orderPickupLocationId: true,
        orderPickupLocationName: true,
        orderShift: true,
        orderPaid: true,
        orderItems: true,
        orderNotes: true,
        orderDraftUpdatedById: true,
        orderDraftUpdatedAt: true,
      },
    })
    await transaction.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: 'ORDER_DRAFT_UPDATED',
        actorId: input.agentId,
        metadata: {
          complete: isOrderDraftComplete(draft),
          fulfillment: draft.orderFulfillment,
          pickupLocationId: draft.orderPickupLocationId,
          paid: draft.orderPaid,
          itemCount: draft.orderItems.length,
        },
      },
    })
    return updated
  })
}
