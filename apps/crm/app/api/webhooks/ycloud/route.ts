import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { decryptSecret, verifyYCloudSignature } from '@/lib/secrets'
import { normalizeE164 } from '@/lib/whatsapp/provider'
import { persistWhatsAppWebhook, webhookPayloadHash } from '@/lib/whatsapp/webhook'
import { parseYCloudWebhook } from '@/lib/whatsapp/ycloud'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      throw new CrmApiError(400, 'INVALID_JSON', 'El webhook de YCloud no contiene JSON válido.')
    }
    const parsed = parseYCloudWebhook(payload)
    let channel = null
    if (parsed.wabaId && parsed.businessPhone) {
      const candidates = await crmPrisma.whatsAppChannel.findMany({
        where: { provider: 'YCLOUD', wabaId: parsed.wabaId },
        take: 3,
      })
      const matching = candidates.filter(item => normalizeE164(item.displayPhoneNumber) === normalizeE164(parsed.businessPhone))
      if (matching.length > 1) throw new CrmApiError(409, 'CHANNEL_AMBIGUOUS', 'Más de un canal de YCloud coincide con el evento.')
      channel = matching[0] || null
    } else {
      const status = parsed.event.statuses[0]
      const existingMessage = status?.id ? await crmPrisma.message.findFirst({
        where: { OR: [
          { waMessageId: status.id },
          ...(status.alternateId ? [{ waMessageId: status.alternateId }] : []),
          ...(status.externalId ? [{ clientMessageId: status.externalId }] : []),
        ] },
        include: { conversation: { include: { channel: true } } },
      }) : null
      channel = existingMessage?.conversation.channel.provider === 'YCLOUD'
        ? existingMessage.conversation.channel
        : null
    }
    if (!channel || (!channel.active && channel.connectionMode !== 'YCLOUD_COEXISTENCE')) {
      throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal de YCloud no está disponible para recibir eventos.')
    }
    if (!channel.appSecretCiphertext || !channel.appSecretIv || !channel.appSecretTag) {
      throw new CrmApiError(503, 'CHANNEL_NOT_CONFIGURED', 'El canal no tiene Webhook Signing Secret configurado.')
    }
    const signingSecret = decryptSecret({
      ciphertext: channel.appSecretCiphertext,
      iv: channel.appSecretIv,
      tag: channel.appSecretTag,
    })
    if (!verifyYCloudSignature(rawBody, request.headers.get('ycloud-signature'), signingSecret)) {
      throw new CrmApiError(401, 'INVALID_SIGNATURE', 'La firma del webhook de YCloud no es válida o está vencida.')
    }

    const payloadHash = webhookPayloadHash(rawBody)
    try {
      await crmPrisma.$transaction(async transaction => {
        const receipt = await transaction.webhookReceipt.create({
          data: { providerEventKey: parsed.eventId, payloadHash, attempts: 1 },
        })
        await persistWhatsAppWebhook(transaction, channel.id, parsed.event)
        await transaction.webhookReceipt.update({
          where: { id: receipt.id },
          data: { processedAt: new Date() },
        })
      })
    } catch (error) {
      const duplicateReceipt = typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'P2002'
        && 'meta' in error
        && JSON.stringify(error.meta).includes('provider_event_key')
      if (duplicateReceipt) return NextResponse.json({ received: true, duplicate: true })
      throw error
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
