import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { encryptSecret, hashVerifyToken } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { publicChannel } from '@/lib/whatsapp/channels'

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
    const accessToken = body.accessToken ? encryptSecret(requireText(body.accessToken, 'Access token', 4096)) : null
    const appSecret = body.appSecret ? encryptSecret(requireText(body.appSecret, 'App Secret', 1024)) : null
    const verifyTokenHash = body.webhookVerifyToken
      ? hashVerifyToken(requireText(body.webhookVerifyToken, 'Webhook Verify Token', 512))
      : null

    const channel = await crmPrisma.whatsAppChannel.create({
      data: {
        name: requireText(body.name, 'Nombre', 100),
        phoneNumberId: requireText(body.phoneNumberId, 'Phone Number ID', 100),
        displayPhoneNumber: body.displayPhoneNumber ? requireText(body.displayPhoneNumber, 'Teléfono visible', 50) : null,
        wabaId: requireText(body.wabaId, 'WABA ID', 100),
        businessPortfolioId: body.businessPortfolioId ? requireText(body.businessPortfolioId, 'Business Portfolio ID', 100) : null,
        graphApiVersion: requireText(body.graphApiVersion, 'Versión de Graph API', 30),
        accessTokenCiphertext: accessToken?.ciphertext,
        accessTokenIv: accessToken?.iv,
        accessTokenTag: accessToken?.tag,
        appSecretCiphertext: appSecret?.ciphertext,
        appSecretIv: appSecret?.iv,
        appSecretTag: appSecret?.tag,
        webhookVerifyTokenHash: verifyTokenHash,
        createdById: user.id,
        updatedById: user.id,
      },
    })
    return NextResponse.json(publicChannel(channel), { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
