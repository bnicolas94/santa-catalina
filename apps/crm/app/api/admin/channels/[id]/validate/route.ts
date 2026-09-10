import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { isChannelReady, publicChannel } from '@/lib/whatsapp/channels'
import { validateMetaChannel } from '@/lib/whatsapp/validation'
import { validateYCloudChannel } from '@/lib/whatsapp/ycloud'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request, true)
    const { id } = await context.params
    const channel = await crmPrisma.whatsAppChannel.findUnique({ where: { id } })
    if (!channel) throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal no existe.')
    if (!isChannelReady(channel) || !channel.accessTokenCiphertext || !channel.accessTokenIv || !channel.accessTokenTag) {
      throw new CrmApiError(409, 'CHANNEL_INCOMPLETE', channel.provider === 'YCLOUD'
        ? 'Guardá la API Key y el Webhook Signing Secret antes de validar la conexión.'
        : 'Guardá los tres secretos antes de validar la conexión.')
    }

    try {
      const accessToken = decryptSecret({
          ciphertext: channel.accessTokenCiphertext,
          iv: channel.accessTokenIv,
          tag: channel.accessTokenTag,
      })
      if (channel.provider === 'META' && !channel.phoneNumberId) {
        throw new CrmApiError(409, 'META_PHONE_ID_MISSING', 'El canal de Meta no tiene Phone Number ID.')
      }
      const validation = channel.provider === 'YCLOUD'
        ? await validateYCloudChannel({
          wabaId: channel.wabaId,
          phoneNumber: channel.displayPhoneNumber || '',
          apiKey: accessToken,
        })
        : await validateMetaChannel({
          graphApiVersion: channel.graphApiVersion,
          wabaId: channel.wabaId,
          phoneNumberId: channel.phoneNumberId!,
          accessToken,
        })
      if (channel.connectionMode === 'COEXISTENCE' && (!validation.isOnBizApp || validation.platformType !== 'CLOUD_API')) {
        throw new CrmApiError(409, 'COEXISTENCE_NOT_CONFIRMED', 'Meta no confirmó que el número siga activo simultáneamente en WhatsApp Business y Cloud API.')
      }
      const updated = await crmPrisma.whatsAppChannel.update({
        where: { id },
        data: {
          connectionStatus: 'CONNECTED',
          lastValidatedAt: new Date(),
          displayPhoneNumber: validation.displayPhoneNumber || channel.displayPhoneNumber,
          isOnBizApp: validation.isOnBizApp,
          platformType: validation.platformType,
          coexistenceVerifiedAt: validation.isOnBizApp ? new Date() : channel.coexistenceVerifiedAt,
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
