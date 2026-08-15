import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto'
import { CrmApiError } from './api'

export type EncryptedSecret = { ciphertext: string; iv: string; tag: string }

function encryptionKey() {
  const configured = process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY
  if (!configured) throw new CrmApiError(503, 'ENCRYPTION_NOT_CONFIGURED', 'Falta configurar la clave maestra del CRM.')
  const key = Buffer.from(configured, 'base64')
  if (key.length !== 32) {
    throw new CrmApiError(503, 'INVALID_ENCRYPTION_KEY', 'La clave maestra debe contener 32 bytes codificados en base64.')
  }
  return key
}

export function encryptSecret(plaintext: string, iv = crypto.getRandomValues(new Uint8Array(12))) {
  const ivBuffer = Buffer.from(iv)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), ivBuffer)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: ivBuffer.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  } satisfies EncryptedSecret
}

export function decryptSecret(secret: EncryptedSecret) {
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(secret.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new CrmApiError(503, 'SECRET_DECRYPTION_FAILED', 'No se pudo descifrar la configuración del canal.')
  }
}

export function hashVerifyToken(token: string) {
  return createHmac('sha256', encryptionKey()).update(token).digest('hex')
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith('sha256=')) return false
  const receivedHex = signatureHeader.slice('sha256='.length)
  if (!/^[0-9a-f]{64}$/i.test(receivedHex)) return false
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  const received = Buffer.from(receivedHex, 'hex')
  return received.length === expected.length && timingSafeEqual(received, expected)
}
