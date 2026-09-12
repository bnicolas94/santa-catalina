import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { encryptSecret } from '../secrets'
import { downloadWhatsAppImage, validatedYCloudMediaUrl } from './media'

function channel() {
  process.env.CRM_MOCK_WHATSAPP = 'false'
  process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const encrypted = encryptSecret('clave-privada')
  return { provider: 'YCLOUD', graphApiVersion: 'v25.0', accessTokenCiphertext: encrypted.ciphertext, accessTokenIv: encrypted.iv, accessTokenTag: encrypted.tag }
}

test('descarga la imagen con su enlace completo y la API Key sólo en servidor', async () => {
  const url = 'https://api.ycloud.com/v2/whatsapp/media/download/123?payload=abc&sig=xyz'
  const result = await downloadWhatsAppImage(channel(), { mediaId: '123', mediaUrl: url }, async (input, init) => {
    assert.equal(String(input), url)
    assert.equal(new Headers(init?.headers).get('X-API-Key'), 'clave-privada')
    assert.equal(init?.redirect, 'error')
    return new Response(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } })
  })
  assert.equal(result.mimeType, 'image/jpeg')
  assert.equal(result.bytes.length, 3)
})

test('rechaza enlaces externos y credenciales embebidas para no filtrar la API Key', () => {
  for (const url of ['https://evil.test/image', 'https://api.ycloud.com.evil.test/v2/whatsapp/media/download/1', 'http://api.ycloud.com/v2/whatsapp/media/download/1', 'https://user:pass@api.ycloud.com/v2/whatsapp/media/download/1', 'https://api.ycloud.com/otra-ruta']) {
    assert.throws(() => validatedYCloudMediaUrl(url))
  }
})

test('intenta recuperar imágenes anteriores que sólo conservaron el ID', async () => {
  await downloadWhatsAppImage(channel(), { mediaId: '123', mediaUrl: null }, async input => {
    assert.equal(String(input), 'https://api.ycloud.com/v2/whatsapp/media/download/123')
    return new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } })
  })
})

test('no sirve HTML ni SVG como una imagen privada', async () => {
  await assert.rejects(downloadWhatsAppImage(channel(), { mediaId: '123', mediaUrl: null }, async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })), /formato de imagen/)
})

test('informa un archivo vencido y limita el tamaño antes de descargarlo', async () => {
  await assert.rejects(downloadWhatsAppImage(channel(), { mediaId: '123', mediaUrl: null }, async () => new Response(null, { status: 404 })), /vencido/)
  await assert.rejects(downloadWhatsAppImage(channel(), { mediaId: '123', mediaUrl: null }, async () => new Response('x', { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(17 * 1024 * 1024) } })), /tamaño/)
})
