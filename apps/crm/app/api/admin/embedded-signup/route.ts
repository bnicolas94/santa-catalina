import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { encryptSecret, hashVerifyToken } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { publicChannel } from '@/lib/whatsapp/channels'
import {
  completeCoexistenceOnboarding,
  embeddedSignupConfigurationStatus,
  requireEmbeddedSignupConfiguration,
} from '@/lib/whatsapp/embedded-signup'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request, true)
    return NextResponse.json(embeddedSignupConfigurationStatus())
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCrmUser(request, true)
    const body = await request.json()
    const config = requireEmbeddedSignupConfiguration()
    const wabaId = requireText(body.wabaId, 'WABA ID', 100)
    const result = await completeCoexistenceOnboarding({
      code: requireText(body.code, 'Código de autorización', 4096),
      wabaId,
      phoneNumberId: body.phoneNumberId ? requireText(body.phoneNumberId, 'Phone Number ID', 100) : null,
    }, config)
    const accessToken = encryptSecret(result.accessToken)
    const appSecret = encryptSecret(config.appSecret)
    const now = new Date()
    const channel = await crmPrisma.whatsAppChannel.upsert({
      where: { phoneNumberId: result.validation.phoneNumberId },
      update: {
        name: result.validation.verifiedName || 'WhatsApp Santa Catalina',
        displayPhoneNumber: result.validation.displayPhoneNumber,
        wabaId,
        businessPortfolioId: body.businessId ? requireText(body.businessId, 'Business Portfolio ID', 100) : undefined,
        graphApiVersion: config.graphApiVersion,
        accessTokenCiphertext: accessToken.ciphertext,
        accessTokenIv: accessToken.iv,
        accessTokenTag: accessToken.tag,
        appSecretCiphertext: appSecret.ciphertext,
        appSecretIv: appSecret.iv,
        appSecretTag: appSecret.tag,
        webhookVerifyTokenHash: hashVerifyToken(config.webhookVerifyToken),
        connectionMode: 'COEXISTENCE',
        connectionStatus: 'CONNECTED',
        isOnBizApp: true,
        platformType: result.validation.platformType,
        coexistenceVerifiedAt: now,
        continuityVerifiedAt: null,
        onboardingCompletedAt: now,
        lastValidatedAt: now,
        active: false,
        updatedById: user.id,
      },
      create: {
        name: result.validation.verifiedName || 'WhatsApp Santa Catalina',
        displayPhoneNumber: result.validation.displayPhoneNumber,
        phoneNumberId: result.validation.phoneNumberId,
        wabaId,
        businessPortfolioId: body.businessId ? requireText(body.businessId, 'Business Portfolio ID', 100) : null,
        graphApiVersion: config.graphApiVersion,
        accessTokenCiphertext: accessToken.ciphertext,
        accessTokenIv: accessToken.iv,
        accessTokenTag: accessToken.tag,
        appSecretCiphertext: appSecret.ciphertext,
        appSecretIv: appSecret.iv,
        appSecretTag: appSecret.tag,
        webhookVerifyTokenHash: hashVerifyToken(config.webhookVerifyToken),
        connectionMode: 'COEXISTENCE',
        connectionStatus: 'CONNECTED',
        isOnBizApp: true,
        platformType: result.validation.platformType,
        coexistenceVerifiedAt: now,
        onboardingCompletedAt: now,
        lastValidatedAt: now,
        active: false,
        createdById: user.id,
        updatedById: user.id,
      },
    })
    return NextResponse.json({ channel: publicChannel(channel), validation: result.validation }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
