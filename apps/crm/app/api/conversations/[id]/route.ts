import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { getErpEmployeeReferences } from '@/lib/erp/client'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { sortMessagesChronologically } from '@/lib/conversations/message-order'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const conversation = await crmPrisma.conversation.findFirst({
      where: { id, ...conversationVisibilityWhere(user) },
      include: {
        contact: true,
        channel: { select: { id: true, name: true, displayPhoneNumber: true, connectionStatus: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 300 },
        scheduledOrders: { orderBy: { scheduledAt: 'desc' }, take: 20 },
        tags: { include: { tag: true } },
        assignments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')

    const agentNames = new Map<string, string>()
    agentNames.set(user.id, user.name)
    if (process.env.NODE_ENV !== 'production') {
      agentNames.set('agent-marina', 'Marina Soto')
      agentNames.set('agent-lucia', 'Lucía Rojas')
      agentNames.set('agent-admin', 'Administración')
    } else {
      try {
        const employees = await getErpEmployeeReferences(
          conversation.scheduledOrders.map(item => item.scheduledById),
          request.headers.get('cookie') || '',
        )
        employees.forEach(employee => agentNames.set(employee.id, employee.name))
      } catch (error) {
        console.error('[CRM ERP agents]', error)
      }
    }

    return NextResponse.json({
      ...conversation,
      messages: sortMessagesChronologically(conversation.messages),
      scheduledOrders: conversation.scheduledOrders.map(item => ({
        ...item,
        scheduledByName: agentNames.get(item.scheduledById) || 'Agente no disponible',
      })),
      tags: conversation.tags.map(item => item.tag),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
