import assert from 'node:assert/strict'
import test from 'node:test'
import { parseYCloudWebhook, validateYCloudChannel } from './ycloud'

test('convierte un mensaje entrante de YCloud al formato interno', () => {
  const parsed = parseYCloudWebhook({
    id: 'evt_in_1',
    type: 'whatsapp.inbound_message.received',
    whatsappInboundMessage: {
      id: 'internal-1', wamid: 'wamid.in.1', wabaId: 'waba-1',
      from: '+549110001111', to: '+5491159813546', sendTime: '2026-09-10T17:00:00.000Z',
      customerProfile: { name: 'Carolina' }, type: 'text', text: { body: 'Hola' },
    },
  })
  assert.equal(parsed.eventId, 'evt_in_1')
  assert.equal(parsed.businessPhone, '+5491159813546')
  assert.equal(parsed.event.messages[0].id, 'wamid.in.1')
  assert.equal(parsed.event.messages[0].text?.body, 'Hola')
  assert.equal(parsed.event.profileName, 'Carolina')
})

test('clasifica ecos, estados e historial de Coexistencia de YCloud', () => {
  const echo = parseYCloudWebhook({
    id: 'evt_echo', type: 'whatsapp.smb.message.echoes',
    whatsappMessage: { id: 'm1', wamid: 'wamid.echo', externalId: 'client-1', wabaId: 'waba-1', from: '+5491159813546', to: '+549110001111', type: 'text', text: { body: 'Desde el teléfono' } },
  })
  assert.equal(echo.event.echoes[0].externalId, 'client-1')

  const status = parseYCloudWebhook({
    id: 'evt_status', type: 'whatsapp.message.updated',
    whatsappMessage: { id: 'm1', wamid: 'wamid.echo', externalId: 'client-1', status: 'delivered' },
  })
  assert.equal(status.event.statuses[0].status, 'delivered')
  assert.equal(status.event.statuses[0].alternateId, 'm1')
  assert.equal(status.wabaId, null)

  const history = parseYCloudWebhook({
    id: 'evt_history', type: 'whatsapp.smb.history',
    whatsappInboundMessage: { id: 'old-1', wabaId: 'waba-1', from: '+549110001111', to: '+5491159813546', type: 'text', text: { body: 'Anterior' } },
  })
  assert.equal(history.event.historyThreads[0].id, '+549110001111')
})

test('usa la hora del evento cuando un eco no incluye sendTime', () => {
  const parsed = parseYCloudWebhook({
    id: 'evt_echo_time', type: 'whatsapp.smb.message.echoes', createTime: '2026-09-10T19:08:00.000Z',
    whatsappMessage: { id: 'm-time', wabaId: 'waba-1', from: '+5491159813546', to: '+549110001111', type: 'text', text: { body: 'Desde el teléfono' } },
  })

  assert.equal(parsed.event.echoes[0].timestamp, '2026-09-10T19:08:00.000Z')
})

test('valida el número conectado consultando YCloud sin enviar mensajes', async () => {
  const validation = await validateYCloudChannel({ wabaId: 'waba-1', phoneNumber: '+54 9 11 5981-3546', apiKey: 'key' }, async (url, init) => {
    assert.match(String(url), /waba-1\/%2B5491159813546$/)
    assert.equal(new Headers(init?.headers).get('X-API-Key'), 'key')
    return Response.json({ phoneNumber: '+5491159813546', verifiedName: 'Santa Catalina', qualityRating: 'GREEN', status: 'CONNECTED' })
  })
  assert.equal(validation.displayPhoneNumber, '+5491159813546')
  assert.equal(validation.verifiedName, 'Santa Catalina')
  assert.equal(validation.isOnBizApp, true)
})
