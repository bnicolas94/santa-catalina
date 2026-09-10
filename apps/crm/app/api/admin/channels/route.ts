import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { encryptSecret, hashVerifyToken } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { publicChannel } from '@/lib/whatsapp/channels'
import { normalizeE164 } from '@/lib/whatsapp/provider'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request, true)
    const channels = await crmPrisma.whatsAppChannel.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(channels.map(publicChannel))
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCrmUser(request, true)
    const body = await request.json()
    const provider = body.provider === 'YCLOUD' ? 'YCLOUD' : body.provider === 'META' || body.provider === undefined ? 'META' : null
    if (!provider) throw new CrmApiError(400, 'INVALID_PROVIDER', 'Proveedor de WhatsApp inválido.')
    const displayPhoneNumber = body.displayPhoneNumber ? requireText(body.displayPhoneNumber, 'Teléfono visible', 50) : null
    const normalizedPhone = provider === 'YCLOUD' ? normalizeE164(displayPhoneNumber) : displayPhoneNumber
    if (provider === 'YCLOUD' && !normalizedPhone) throw new CrmApiError(400, 'INVALID_PHONE_NUMBER', 'YCloud requiere el número en formato internacional, por ejemplo +5491112345678.')
    const accessToken = body.accessToken ? encryptSecret(requireText(body.accessToken, provider === 'YCLOUD' ? 'API Key de YCloud' : 'Access token', 4096)) : null
    const appSecret = body.appSecret ? encryptSecret(requireText(body.appSecret, provider === 'YCLOUD' ? 'Webhook Signing Secret' : 'App Secret', 1024)) : null
    const verifyTokenHash = provider === 'META' && body.webhookVerifyToken
      ? hashVerifyToken(requireText(body.webhookVerifyToken, 'Webhook Verify Token', 512))
      : null

    const channel = await crmPrisma.whatsAppChannel.create({
      data: {
        name: requireText(body.name, 'Nombre', 100),
        provider,
        phoneNumberId: provider === 'META' ? requireText(body.phoneNumberId, 'Phone Number ID', 100) : null,
        displayPhoneNumber: normalizedPhone,
        wabaId: requireText(body.wabaId, 'WABA ID', 100),
        businessPortfolioId: body.businessPortfolioId ? requireText(body.businessPortfolioId, 'Business Portfolio ID', 100) : null,
        graphApiVersion: provider === 'META' ? requireText(body.graphApiVersion, 'Versión de Graph API', 30) : 'v25.0',
        accessTokenCiphertext: accessToken?.ciphertext,
        accessTokenIv: accessToken?.iv,
        accessTokenTag: accessToken?.tag,
        appSecretCiphertext: appSecret?.ciphertext,
        appSecretIv: appSecret?.iv,
        appSecretTag: appSecret?.tag,
        webhookVerifyTokenHash: verifyTokenHash,
        connectionMode: provider === 'YCLOUD' ? 'YCLOUD_COEXISTENCE' : 'MANUAL',
        createdById: user.id,
        updatedById: user.id,
      },
    })
    return NextResponse.json(publicChannel(channel), { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
