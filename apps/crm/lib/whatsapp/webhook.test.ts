import assert from 'node:assert/strict'
import test from 'node:test'
import { parseWhatsAppWebhook, webhookPayloadHash } from './webhook'

test('extrae mensajes y estados del webhook de WhatsApp', () => {
  const parsed = parseWhatsAppWebhook({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: 'phone-1' },
      contacts: [{ profile: { name: 'Carolina' } }],
      messages: [{ id: 'wamid.1', from: '5491164821930', type: 'text', text: { body: 'Hola' } }],
      statuses: [{ id: 'wamid.0', status: 'delivered' }],
    } }] }],
  })
  assert.equal(parsed.phoneNumberId, 'phone-1')
  assert.equal(parsed.profileName, 'Carolina')
  assert.equal(parsed.messages[0].text?.body, 'Hola')
  assert.equal(parsed.statuses[0].status, 'delivered')
})

test('rechaza objetos ajenos a WhatsApp y genera hashes estables', () => {
  assert.throws(() => parseWhatsAppWebhook({ object: 'page', entry: [] }))
  assert.equal(webhookPayloadHash('payload'), webhookPayloadHash('payload'))
  assert.notEqual(webhookPayloadHash('payload'), webhookPayloadHash('payload-2'))
})
