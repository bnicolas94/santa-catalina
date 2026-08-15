import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac, randomBytes } from 'node:crypto'
import { decryptSecret, encryptSecret, hashVerifyToken, verifyMetaSignature } from './secrets'

test('cifra secretos con AES-GCM y detecta alteraciones', () => {
  process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const encrypted = encryptSecret('token-muy-secreto', new Uint8Array(12).fill(7))
  assert.equal(decryptSecret(encrypted), 'token-muy-secreto')
  const alteredBytes = Buffer.from(encrypted.ciphertext, 'base64')
  alteredBytes[0] ^= 1
  assert.throws(() => decryptSecret({ ...encrypted, ciphertext: alteredBytes.toString('base64') }))
})

test('el hash de verificación no conserva el token original', () => {
  process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const hash = hashVerifyToken('verify-token')
  assert.equal(hash.length, 64)
  assert.equal(hash.includes('verify-token'), false)
})

test('valida la firma de Meta sobre el cuerpo crudo', () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account' })
  const secret = 'app-secret'
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyMetaSignature(body, signature, secret), true)
  assert.equal(verifyMetaSignature(`${body} `, signature, secret), false)
  assert.equal(verifyMetaSignature(body, null, secret), false)
})
