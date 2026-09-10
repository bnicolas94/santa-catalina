import type { ErpOrderDetails } from '@santa-catalina/contracts'
import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { getErpOrderDetails } from '@/lib/erp/client'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

function demoOrder(orderId: string, customerName: string): ErpOrderDetails {
  const second = orderId === 'demo-order-2'
  return {
    id: orderId,
    orderedAt: second ? '2026-08-05T13:00:00.000Z' : '2026-08-12T13:00:00.000Z',
    deliveryAt: second ? '2026-08-06T13:00:00.000Z' : '2026-08-13T13:00:00.000Z',
    status: 'entregado',
    totalUnits: second ? 72 : 96,
    totalPacks: second ? 3 : 4,
    totalAmount: second ? 111400 : 148500,
    paid: true,
    paymentMethod: 'transferencia',
    fulfillment: 'DELIVERY',
    shift: second ? 'tarde' : 'mañana',
    pickupLocation: null,
    customer: {
      id: 'demo-erp-client',
      commercialName: customerName,
      contactName: customerName,
      phone: '+54 9 11 0000-0000',
      currentAddress: 'Calle 12 1845',
      locality: 'La Plata',
      zone: 'Centro',
    },
    items: second
      ? [
          { productId: 'demo-product-classic', presentationId: 'demo-classic-24', productName: 'Triple clásico', productCode: 'CLA', unitsPerPackage: 24, quantity: 2, unitPrice: 22000, totalAmount: 44000, totalUnits: 48 },
          { productId: 'demo-product-ham-cheese', presentationId: 'demo-ham-cheese-24', productName: 'Jamón y queso', productCode: 'JYQ', unitsPerPackage: 24, quantity: 1, unitPrice: 23500, totalAmount: 23500, totalUnits: 24 },
        ]
      : [
          { productId: 'demo-product-classic', presentationId: 'demo-classic-48', productName: 'Triple clásico', productCode: 'CLA', unitsPerPackage: 48, quantity: 1, unitPrice: 42000, totalAmount: 42000, totalUnits: 48 },
          { productId: 'demo-product-ham-cheese', presentationId: 'demo-ham-cheese-24', productName: 'Jamón y queso', productCode: 'JYQ', unitsPerPackage: 24, quantity: 2, unitPrice: 23500, totalAmount: 47000, totalUnits: 48, notes: 'Sin aceitunas' },
        ],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const user = await requireCrmUser(request)
    const { id, orderId } = await params
    const conversation = await crmPrisma.conversation.findFirst({
      where: { id, ...conversationVisibilityWhere(user) },
      select: { contact: { select: { erpClientId: true, displayName: true } } },
    })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(demoOrder(orderId, conversation.contact.displayName))
    }
    if (!conversation.contact.erpClientId) {
      throw new CrmApiError(409, 'ERP_CUSTOMER_NOT_LINKED', 'Vinculá el cliente antes de consultar sus pedidos.')
    }

    const order = await getErpOrderDetails(orderId, request.headers.get('cookie') || '')
    if (order.customer.id !== conversation.contact.erpClientId) {
      throw new CrmApiError(404, 'ERP_ORDER_NOT_FOUND', 'El pedido no pertenece al cliente vinculado.')
    }
    return NextResponse.json(order, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
