import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse, requireText } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { encryptSecret, hashVerifyToken } from '@/lib/secrets'
import { requireCrmUser } from '@/lib/session'
import { isChannelReady, isCoexistenceReady, publicChannel } from '@/lib/whatsapp/channels'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request, true)
    const { id } = await context.params
    const body = await request.json()
    const existing = await crmPrisma.whatsAppChannel.findUnique({ where: { id } })
    if (!existing) throw new CrmApiError(404, 'CHANNEL_NOT_FOUND', 'El canal no existe.')
    const changesValidatedIdentity = (body.phoneNumberId !== undefined && String(body.phoneNumberId).trim() !== existing.phoneNumberId)
      || (body.wabaId !== undefined && String(body.wabaId).trim() !== existing.wabaId)
      || (body.graphApiVersion !== undefined && String(body.graphApiVersion).trim() !== existing.graphApiVersion)
    const changesCredentials = Boolean(body.accessToken || body.appSecret || body.webhookVerifyToken)
    if (body.active === true && !isChannelReady(existing, body)) {
      throw new CrmApiError(409, 'CHANNEL_INCOMPLETE', 'Completá Access Token, App Secret y Verify Token antes de activar el canal.')
    }
    if (body.active === true && !isCoexistenceReady(existing)) {
      throw new CrmApiError(409, 'COEXISTENCE_NOT_CONFIRMED', 'Meta debe confirmar Coexistence y un administrador debe validar todas las sesiones antes de habilitar el canal.')
    }
    if (body.active === true && (existing.connectionStatus !== 'CONNECTED' || changesValidatedIdentity || changesCredentials)) {
      throw new CrmApiError(409, 'CHANNEL_NOT_VALIDATED', 'Validá la conexión con Meta antes de activar el canal.')
    }
    const accessToken = body.accessToken ? encryptSecret(requireText(body.accessToken, 'Access token', 4096)) : null
    const appSecret = body.appSecret ? encryptSecret(requireText(body.appSecret, 'App Secret', 1024)) : null

    const channel = await crmPrisma.whatsAppChannel.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: requireText(body.name, 'Nombre', 100) }),
        ...(body.phoneNumberId !== undefined && { phoneNumberId: requireText(body.phoneNumberId, 'Phone Number ID', 100) }),
        ...(body.displayPhoneNumber !== undefined && { displayPhoneNumber: body.displayPhoneNumber ? requireText(body.displayPhoneNumber, 'Teléfono visible', 50) : null }),
        ...(body.wabaId !== undefined && { wabaId: requireText(body.wabaId, 'WABA ID', 100) }),
        ...(body.businessPortfolioId !== undefined && { businessPortfolioId: body.businessPortfolioId ? requireText(body.businessPortfolioId, 'Business Portfolio ID', 100) : null }),
        ...(body.graphApiVersion !== undefined && { graphApiVersion: requireText(body.graphApiVersion, 'Versión de Graph API', 30) }),
        ...(body.active !== undefined && { active: body.active === true }),
        ...(accessToken && {
          accessTokenCiphertext: accessToken.ciphertext, accessTokenIv: accessToken.iv, accessTokenTag: accessToken.tag,
          connectionStatus: 'PENDING', lastValidatedAt: null,
        }),
        ...(appSecret && {
          appSecretCiphertext: appSecret.ciphertext, appSecretIv: appSecret.iv, appSecretTag: appSecret.tag,
        }),
        ...(body.webhookVerifyToken && {
          webhookVerifyTokenHash: hashVerifyToken(requireText(body.webhookVerifyToken, 'Webhook Verify Token', 512)),
        }),
        ...((changesValidatedIdentity || changesCredentials) && {
          active: false, connectionStatus: 'PENDING', lastValidatedAt: null,
          ...(existing.connectionMode === 'COEXISTENCE' && {
            isOnBizApp: false, coexistenceVerifiedAt: null, continuityVerifiedAt: null,
          }),
        }),
        updatedById: user.id,
      },
    })
    return NextResponse.json(publicChannel(channel))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
