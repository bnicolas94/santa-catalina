import assert from 'node:assert/strict'
import test from 'node:test'
import { isWhatsAppMockEnabled } from './provider'

test('el modo simulado puede proteger también un despliegue de prueba', () => {
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'production', CRM_MOCK_WHATSAPP: 'true' }), true)
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'production', CRM_MOCK_WHATSAPP: 'false' }), false)
})

test('desarrollo simula por defecto y permite optar por el proveedor real', () => {
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'development', CRM_MOCK_WHATSAPP: undefined }), true)
  assert.equal(isWhatsAppMockEnabled({ NODE_ENV: 'development', CRM_MOCK_WHATSAPP: 'false' }), false)
})
