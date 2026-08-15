import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { decryptSecret, hashVerifyToken, verifyMetaSignature } from '@/lib/secrets'
import { parseWhatsAppWebhook, persistWhatsAppWebhook, webhookPayloadHash } from '@/lib/whatsapp/webhook'

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('hub.mode')
    const token = request.nextUrl.searchParams.get('hub.verify_token')
    const challenge = request.nextUrl.searchParams.get('hub.challenge')
    if (mode !== 'subscribe' || !token || !challenge) {
      throw new CrmApiError(400, 'INVALID_VERIFICATION', 'La verificación del webhook está incompleta.')
    }
    const channel = await crmPrisma.whatsAppChannel.findFirst({
      where: { active: true, webhookVerifyTokenHash: hashVerifyToken(token) },
      select: { id: true },
    })
    if (!channel) throw new CrmApiError(403, 'INVALID_VERIFY_TOKEN', 'El verify token no coincide.')
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let unknownPayload: unknown
    try {
      unknownPayload = JSON.parse(rawBody)
    } catch {
      throw new CrmApiError(400, 'INVALID_JSON', 'El webhook no contiene JSON válido.')
    }
    const event = parseWhatsAppWebhook(unknownPayload)
    const channel = await crmPrisma.whatsAppChannel.findUnique({ where: { phoneNumberId: event.phoneNumberId } })
    if (!channel || !channel.active) throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal no está activo.')
    if (!channel.appSecretCiphertext || !channel.appSecretIv || !channel.appSecretTag) {
      throw new CrmApiError(503, 'CHANNEL_NOT_CONFIGURED', 'El canal no tiene App Secret configurado.')
    }
    const appSecret = decryptSecret({
      ciphertext: channel.appSecretCiphertext,
      iv: channel.appSecretIv,
      tag: channel.appSecretTag,
    })
    if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
      throw new CrmApiError(401, 'INVALID_SIGNATURE', 'La firma del webhook no es válida.')
    }

    const payloadHash = webhookPayloadHash(rawBody)
    try {
      await crmPrisma.$transaction(async transaction => {
        const receipt = await transaction.webhookReceipt.create({
          data: { providerEventKey: payloadHash, payloadHash, attempts: 1 },
        })
        await persistWhatsAppWebhook(transaction, channel.id, event)
        await transaction.webhookReceipt.update({
          where: { id: receipt.id }, data: { processedAt: new Date() },
        })
      })
    } catch (error) {
      const duplicateReceipt = typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'P2002'
        && 'meta' in error
        && JSON.stringify(error.meta).includes('provider_event_key')
      if (duplicateReceipt) {
        return NextResponse.json({ received: true, duplicate: true })
      }
      throw error
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
