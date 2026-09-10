import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { updateConversationOrderDraft } from '@/lib/conversations/order-draft'
import { getAvailablePickupLocations } from '@/lib/erp/client'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
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
    })
    return NextResponse.json({ draft })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
