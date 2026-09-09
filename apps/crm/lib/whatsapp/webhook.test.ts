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

test('clasifica los eventos de Coexistence sin confundir ecos con mensajes entrantes', () => {
  const parsed = parseWhatsAppWebhook({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-1', changes: [
      { field: 'smb_message_echoes', value: {
        metadata: { phone_number_id: 'phone-1' },
        message_echoes: [{ id: 'wamid.echo', from: '5491100000000', to: '5491199999999', type: 'text', text: { body: 'Respuesta desde el teléfono' } }],
      } },
      { field: 'smb_app_state_sync', value: {
        metadata: { phone_number_id: 'phone-1' },
        state_sync: [{ type: 'contact', contact: { full_name: 'Cliente Guardado', phone_number: '+5491199999999' } }],
      } },
      { field: 'history', value: {
        metadata: { phone_number_id: 'phone-1' },
        history: [{ threads: [{ id: '5491199999999', messages: [{ id: 'wamid.old', from: '5491199999999', type: 'text', text: { body: 'Anterior' } }] }] }],
      } },
    ] }],
  })
  assert.equal(parsed.wabaId, 'waba-1')
  assert.equal(parsed.messages.length, 0)
  assert.equal(parsed.echoes[0].to, '5491199999999')
  assert.equal(parsed.syncedContacts[0].contact?.full_name, 'Cliente Guardado')
  assert.equal(parsed.historyThreads[0].messages?.[0].id, 'wamid.old')
})

test('acepta una baja de Coexistence identificada solamente por WABA', () => {
  const parsed = parseWhatsAppWebhook({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-1', changes: [{ field: 'account_update', value: { event: 'ACCOUNT_OFFBOARDED' } }] }],
  })
  assert.equal(parsed.phoneNumberId, null)
  assert.equal(parsed.accountUpdates[0].event, 'ACCOUNT_OFFBOARDED')
})

test('rechaza objetos ajenos a WhatsApp y genera hashes estables', () => {
  assert.throws(() => parseWhatsAppWebhook({ object: 'page', entry: [] }))
  assert.equal(webhookPayloadHash('payload'), webhookPayloadHash('payload'))
  assert.notEqual(webhookPayloadHash('payload'), webhookPayloadHash('payload-2'))
})
