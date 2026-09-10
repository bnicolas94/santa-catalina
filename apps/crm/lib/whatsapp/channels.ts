import type { WhatsAppChannel } from '@/generated/prisma'

type ChannelSecretState = Pick<WhatsAppChannel, 'provider' | 'accessTokenCiphertext' | 'appSecretCiphertext' | 'webhookVerifyTokenHash'>

export function isChannelReady(channel: ChannelSecretState, updates?: {
  accessToken?: string | null
  appSecret?: string | null
  webhookVerifyToken?: string | null
}) {
  const providerCredentialReady = Boolean(
    updates?.accessToken || channel.accessTokenCiphertext,
  ) && Boolean(
    updates?.appSecret || channel.appSecretCiphertext,
  )
  if (channel.provider === 'YCLOUD') return providerCredentialReady
  return providerCredentialReady && Boolean(
    updates?.webhookVerifyToken || channel.webhookVerifyTokenHash,
  )
}

export function isCoexistenceReady(channel: Pick<WhatsAppChannel, 'provider' | 'connectionMode' | 'isOnBizApp' | 'platformType' | 'continuityVerifiedAt'>) {
  if (channel.connectionMode === 'YCLOUD_COEXISTENCE') {
    return channel.provider === 'YCLOUD'
      && channel.isOnBizApp
      && channel.platformType === 'CLOUD_API'
      && Boolean(channel.continuityVerifiedAt)
  }
  return channel.connectionMode !== 'COEXISTENCE'
    || (channel.isOnBizApp && channel.platformType === 'CLOUD_API' && Boolean(channel.continuityVerifiedAt))
}

export function encryptionConfigurationStatus(value = process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY) {
  if (!value) return 'MISSING' as const
  return Buffer.from(value, 'base64').length === 32 ? 'READY' as const : 'INVALID' as const
}

export function publicChannel(channel: WhatsAppChannel) {
  return {
    id: channel.id,
    name: channel.name,
    provider: channel.provider,
    active: channel.active,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    wabaId: channel.wabaId,
    businessPortfolioId: channel.businessPortfolioId,
    graphApiVersion: channel.graphApiVersion,
    connectionMode: channel.connectionMode,
    connectionStatus: channel.connectionStatus,
    isOnBizApp: channel.isOnBizApp,
    platformType: channel.platformType,
    coexistenceVerifiedAt: channel.coexistenceVerifiedAt,
    continuityVerifiedAt: channel.continuityVerifiedAt,
    onboardingCompletedAt: channel.onboardingCompletedAt,
    lastValidatedAt: channel.lastValidatedAt,
    hasAccessToken: Boolean(channel.accessTokenCiphertext),
    hasAppSecret: Boolean(channel.appSecretCiphertext),
    hasVerifyToken: Boolean(channel.webhookVerifyTokenHash),
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }
}
