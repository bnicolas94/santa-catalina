import assert from 'node:assert/strict'
import test from 'node:test'
import type { WhatsAppChannel } from '@/generated/prisma'
import { encryptionConfigurationStatus, isChannelReady, publicChannel } from './channels'

test('un canal requiere los tres secretos antes de activarse', () => {
  const empty = { accessTokenCiphertext: null, appSecretCiphertext: null, webhookVerifyTokenHash: null }
  assert.equal(isChannelReady(empty), false)
  assert.equal(isChannelReady(empty, { accessToken: 'token', appSecret: 'secret', webhookVerifyToken: 'verify' }), true)
})

test('reconoce una clave maestra base64 de exactamente 32 bytes', () => {
  assert.equal(encryptionConfigurationStatus(undefined), 'MISSING')
  assert.equal(encryptionConfigurationStatus(Buffer.alloc(16).toString('base64')), 'INVALID')
  assert.equal(encryptionConfigurationStatus(Buffer.alloc(32).toString('base64')), 'READY')
})

test('la respuesta pública nunca incluye material cifrado', () => {
  const channel = {
    id: 'channel', name: 'Canal', active: false, phoneNumberId: 'phone', displayPhoneNumber: null,
    wabaId: 'waba', businessPortfolioId: null, graphApiVersion: 'v23.0', connectionStatus: 'PENDING',
    lastValidatedAt: null, accessTokenCiphertext: 'cipher', accessTokenIv: 'iv', accessTokenTag: 'tag',
    appSecretCiphertext: 'cipher', appSecretIv: 'iv', appSecretTag: 'tag', webhookVerifyTokenHash: 'hash',
    createdById: 'admin', updatedById: 'admin', createdAt: new Date(), updatedAt: new Date(),
  } as WhatsAppChannel
  const result = publicChannel(channel)
  assert.equal(result.hasAccessToken, true)
  assert.equal('accessTokenCiphertext' in result, false)
  assert.equal('webhookVerifyTokenHash' in result, false)
})
