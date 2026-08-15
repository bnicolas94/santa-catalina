import type { WhatsAppChannel } from '@/generated/prisma'

type ChannelSecretState = Pick<WhatsAppChannel, 'accessTokenCiphertext' | 'appSecretCiphertext' | 'webhookVerifyTokenHash'>

export function isChannelReady(channel: ChannelSecretState, updates?: {
  accessToken?: string | null
  appSecret?: string | null
  webhookVerifyToken?: string | null
}) {
  return Boolean(
    updates?.accessToken || channel.accessTokenCiphertext,
  ) && Boolean(
    updates?.appSecret || channel.appSecretCiphertext,
  ) && Boolean(
    updates?.webhookVerifyToken || channel.webhookVerifyTokenHash,
  )
}

export function encryptionConfigurationStatus(value = process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY) {
  if (!value) return 'MISSING' as const
  return Buffer.from(value, 'base64').length === 32 ? 'READY' as const : 'INVALID' as const
}

export function publicChannel(channel: WhatsAppChannel) {
  return {
    id: channel.id,
    name: channel.name,
    active: channel.active,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    wabaId: channel.wabaId,
    businessPortfolioId: channel.businessPortfolioId,
    graphApiVersion: channel.graphApiVersion,
    connectionStatus: channel.connectionStatus,
    lastValidatedAt: channel.lastValidatedAt,
    hasAccessToken: Boolean(channel.accessTokenCiphertext),
    hasAppSecret: Boolean(channel.appSecretCiphertext),
    hasVerifyToken: Boolean(channel.webhookVerifyTokenHash),
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }
}
