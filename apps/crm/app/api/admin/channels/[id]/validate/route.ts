import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { isChannelReady, publicChannel } from '@/lib/whatsapp/channels'
import { validateMetaChannel } from '@/lib/whatsapp/validation'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request, true)
    const { id } = await context.params
    const channel = await crmPrisma.whatsAppChannel.findUnique({ where: { id } })
    if (!channel) throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal no existe.')
    if (!isChannelReady(channel) || !channel.accessTokenCiphertext || !channel.accessTokenIv || !channel.accessTokenTag) {
      throw new CrmApiError(409, 'CHANNEL_INCOMPLETE', 'Guardá los tres secretos antes de validar la conexión.')
    }

    try {
      const validation = await validateMetaChannel({
        graphApiVersion: channel.graphApiVersion,
        wabaId: channel.wabaId,
        phoneNumberId: channel.phoneNumberId,
        accessToken: decryptSecret({
          ciphertext: channel.accessTokenCiphertext,
          iv: channel.accessTokenIv,
          tag: channel.accessTokenTag,
        }),
      })
      const updated = await crmPrisma.whatsAppChannel.update({
        where: { id },
        data: {
          connectionStatus: 'CONNECTED',
          lastValidatedAt: new Date(),
          displayPhoneNumber: validation.displayPhoneNumber || channel.displayPhoneNumber,
          updatedById: user.id,
        },
      })
      return NextResponse.json({ channel: publicChannel(updated), validation })
    } catch (error) {
      await crmPrisma.whatsAppChannel.update({
        where: { id },
        data: { active: false, connectionStatus: 'FAILED', lastValidatedAt: new Date(), updatedById: user.id },
      })
      throw error
    }
  } catch (error) {
    return apiErrorResponse(error)
  }
}
