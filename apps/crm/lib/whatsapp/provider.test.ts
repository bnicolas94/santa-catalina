import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { encryptSecret } from '../secrets'
import { isWhatsAppMockEnabled, markWhatsAppMessageRead, sendWhatsAppText } from './provider'

test('el modo simulado puede proteger también un despliegue de prueba', () => {
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'production', CRM_MOCK_WHATSAPP: 'true' }), true)
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'production', CRM_MOCK_WHATSAPP: 'false' }), false)
})

test('desarrollo simula por defecto y permite optar por el proveedor real', () => {
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'development', CRM_MOCK_WHATSAPP: undefined }), true)
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'development', CRM_MOCK_WHATSAPP: 'false' }), false)
})

test('YCloud envía texto con API Key, E.164 e idempotencia externa', async () => {
  process.env.CRM_MOCK_WHATSAPP = 'false'
  process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const encrypted = encryptSecret('ycloud-key')
  let requestBody: Record<string, unknown> = {}
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get('X-API-Key'), 'ycloud-key')
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return Response.json({ id: 'msg_ycloud_1', wamid: 'wamid.1' })
  }
  const result = await sendWhatsAppText({
    provider: 'YCLOUD', phoneNumberId: null, displayPhoneNumber: '+54 9 11 5981-3546', graphApiVersion: 'v25.0',
    accessTokenCiphertext: encrypted.ciphertext, accessTokenIv: encrypted.iv, accessTokenTag: encrypted.tag,
  }, '549110001111', 'Hola', 'wamid.original', 'client-1', fetcher)
  assert.equal(result.providerMessageId, 'wamid.1')
  assert.equal(requestBody.from, '+5491159813546')
  assert.equal(requestBody.to, '+549110001111')
  assert.equal(requestBody.externalId, 'client-1')
  assert.deepEqual(requestBody.context, { message_id: 'wamid.original' })
})

test('YCloud marca como leído usando el wamid y la API Key cifrada', async () => {
  process.env.CRM_MOCK_WHATSAPP = 'false'
  process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const encrypted = encryptSecret('ycloud-key')
  const result = await markWhatsAppMessageRead({
    provider: 'YCLOUD', phoneNumberId: null, displayPhoneNumber: '+5491159813546', graphApiVersion: 'v25.0',
    accessTokenCiphertext: encrypted.ciphertext, accessTokenIv: encrypted.iv, accessTokenTag: encrypted.tag,
  }, 'wamid.HBgNODYx', async (url, init) => {
    assert.match(String(url), /inboundMessages\/wamid\.HBgNODYx\/markAsRead$/)
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('X-API-Key'), 'ycloud-key')
    return Response.json({ success: true })
  })
  assert.equal(result.providerMarked, true)
})
