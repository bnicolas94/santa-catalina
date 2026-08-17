import type { CustomerContextResponse, ErpCustomerDetails } from '@santa-catalina/contracts'
import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { getErpCustomerSummary, resolveErpCustomer } from '@/lib/erp/client'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

function demoCustomer(contact: { displayName: string; phoneE164: string }): ErpCustomerDetails {
  return {
    id: 'demo-erp-client',
    commercialName: contact.displayName.includes('Sofía') ? 'Despensa El Trébol' : 'Almacén Santa Rita',
    contactName: contact.displayName,
    phone: contact.phoneE164,
    address: 'Calle 12 1845',
    locality: 'La Plata',
    zone: 'Centro',
    segment: 'Comercio minorista',
    active: true,
    orderCount: 18,
    recentOrders: [
      {
        id: 'demo-order-1',
        orderedAt: '2026-08-12T13:00:00.000Z',
        deliveryAt: '2026-08-13T13:00:00.000Z',
        status: 'entregado',
        totalUnits: 96,
        totalPacks: 4,
        totalAmount: 148500,
        paid: true,
      },
      {
        id: 'demo-order-2',
        orderedAt: '2026-08-05T13:00:00.000Z',
        deliveryAt: '2026-08-06T13:00:00.000Z',
        status: 'entregado',
        totalUnits: 72,
        totalPacks: 3,
        totalAmount: 111400,
        paid: true,
      },
    ],
  }
}

async function conversationContact(id: string) {
  const conversation = await crmPrisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      contact: {
        select: { id: true, erpClientId: true, displayName: true, phoneE164: true },
      },
    },
  })
  if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
  return conversation
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const conversation = await conversationContact(id)

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        status: 'LINKED',
        customer: demoCustomer(conversation.contact),
        linkedAutomatically: true,
      } satisfies CustomerContextResponse)
    }

    const cookie = request.headers.get('cookie') || ''
    try {
      if (conversation.contact.erpClientId) {
        const customer = await getErpCustomerSummary(conversation.contact.erpClientId, cookie)
        return NextResponse.json({ status: 'LINKED', customer, linkedAutomatically: false } satisfies CustomerContextResponse)
      }

      const resolution = await resolveErpCustomer(conversation.contact.phoneE164, cookie)
      if (resolution.candidates.length === 0) {
        return NextResponse.json({ status: 'NOT_FOUND', candidates: [] } satisfies CustomerContextResponse)
      }
      if (resolution.candidates.length > 1) {
        return NextResponse.json({ status: 'CANDIDATES', candidates: resolution.candidates } satisfies CustomerContextResponse)
      }

      const candidate = resolution.candidates[0]
      const customer = await getErpCustomerSummary(candidate.id, cookie)
      await crmPrisma.$transaction([
        crmPrisma.contact.update({ where: { id: conversation.contact.id }, data: { erpClientId: candidate.id } }),
        crmPrisma.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            type: 'ERP_CLIENT_AUTO_LINKED',
            actorId: user.id,
            metadata: { erpClientId: candidate.id, matchQuality: candidate.matchQuality },
          },
        }),
      ])
      return NextResponse.json({ status: 'LINKED', customer, linkedAutomatically: true } satisfies CustomerContextResponse)
    } catch (error) {
      console.error('[CRM ERP context]', error)
      return NextResponse.json({
        status: 'UNAVAILABLE',
        candidates: [],
        message: 'El contexto comercial no está disponible por el momento.',
      } satisfies CustomerContextResponse)
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const conversation = await conversationContact(id)
    const body = await request.json()
    const erpClientId = requireText(body.erpClientId, 'erpClientId', 80)
    const customer = process.env.NODE_ENV !== 'production'
      ? demoCustomer(conversation.contact)
      : await getErpCustomerSummary(erpClientId, request.headers.get('cookie') || '')

    if (conversation.contact.erpClientId !== erpClientId) {
      await crmPrisma.$transaction([
        crmPrisma.contact.update({ where: { id: conversation.contact.id }, data: { erpClientId } }),
        crmPrisma.conversationEvent.create({
          data: {
            conversationId: conversation.id,
            type: 'ERP_CLIENT_LINKED',
            actorId: user.id,
            metadata: { erpClientId, previousErpClientId: conversation.contact.erpClientId },
          },
        }),
      ])
    }
    return NextResponse.json({ status: 'LINKED', customer, linkedAutomatically: false } satisfies CustomerContextResponse)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
