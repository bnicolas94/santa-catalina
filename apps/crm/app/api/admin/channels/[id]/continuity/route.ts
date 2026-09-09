import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'
import { publicChannel } from '@/lib/whatsapp/channels'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request, true)
    const { id } = await context.params
    const body = await request.json()
    const channel = await crmPrisma.whatsAppChannel.findUnique({ where: { id } })
    if (!channel) throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal no existe.')
    if (channel.connectionMode !== 'COEXISTENCE' || !channel.isOnBizApp || channel.platformType !== 'CLOUD_API') {
      throw new CrmApiError(409, 'COEXISTENCE_NOT_CONFIRMED', 'Primero Meta debe confirmar Coexistence para este número.')
    }
    if (body.mobileApp !== true || body.linkedDevices !== true || body.bidirectionalMessages !== true) {
      throw new CrmApiError(400, 'CONTINUITY_CHECKLIST_INCOMPLETE', 'Confirmá la aplicación, los dispositivos vinculados y los mensajes bidireccionales.')
    }
    const updated = await crmPrisma.whatsAppChannel.update({
      where: { id },
      data: { continuityVerifiedAt: new Date(), updatedById: user.id },
    })
    return NextResponse.json(publicChannel(updated))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
