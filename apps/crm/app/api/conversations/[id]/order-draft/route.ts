import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { canonicalizeOrderItems, normalizeStoredOrderItems, orderItemSelectionKey, updateConversationOrderDraft } from '@/lib/conversations/order-draft'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { getAvailablePickupLocations, getAvailableProductCatalog } from '@/lib/erp/client'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const current = await crmPrisma.conversation.findFirst({
      where: { id, ...conversationVisibilityWhere(user) },
      select: { orderItems: true },
    })
    if (!current) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    const itemsUnchanged = orderItemSelectionKey(body.orderItems) === orderItemSelectionKey(current.orderItems)
    const orderItems = itemsUnchanged
      ? normalizeStoredOrderItems(current.orderItems)
      : canonicalizeOrderItems(body.orderItems, await getAvailableProductCatalog(request.headers.get('cookie') || ''))
    let pickupLocationId: string | null = null
    let pickupLocationName: string | null = null
    if (body.orderFulfillment === 'PICKUP' && body.orderPickupLocationId) {
      pickupLocationId = requireText(body.orderPickupLocationId, 'orderPickupLocationId', 80)
      const locations = await getAvailablePickupLocations(request.headers.get('cookie') || '')
      const location = locations.find(item => item.id === pickupLocationId)
      if (!location) {
        throw new CrmApiError(400, 'PICKUP_LOCATION_UNAVAILABLE', 'El local de retiro ya no está disponible.')
      }
      pickupLocationName = location.name
    }
    const draft = await updateConversationOrderDraft(crmPrisma, {
      conversationId: id,
      agentId: user.id,
      lockToken: requireText(body.lockToken, 'lockToken', 100),
      orderDate: body.orderDate,
      orderAddress: body.orderAddress,
      orderFulfillment: body.orderFulfillment,
      orderPickupLocationId: pickupLocationId,
      orderPickupLocationName: pickupLocationName,
      orderShift: body.orderShift,
      orderPaid: body.orderPaid,
      orderItems,
      orderNotes: body.orderNotes,
    })
    return NextResponse.json({ draft })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
