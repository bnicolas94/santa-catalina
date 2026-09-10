import { CrmApiError } from '../api'
import { decryptSecret } from '../secrets'

type ChannelCredentials = {
  provider: string
  phoneNumberId: string | null
  displayPhoneNumber: string | null
  graphApiVersion: string
  accessTokenCiphertext: string | null
  accessTokenIv: string | null
  accessTokenTag: string | null
}

export function isWhatsAppMockEnabled(env: { NODE_ENV?: string; CRM_MOCK_WHATSAPP?: string } = process.env) {
  return env.CRM_MOCK_WHATSAPP === 'true'
    || (env.NODE_ENV !== 'production' && env.CRM_MOCK_WHATSAPP !== 'false')
}

export function normalizeE164(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
}

export async function sendWhatsAppText(
  channel: ChannelCredentials,
  recipientWaId: string,
  text: string,
  replyToWaMessageId?: string | null,
  clientMessageId?: string,
  fetcher: typeof fetch = fetch,
) {
  if (isWhatsAppMockEnabled()) {
    return { providerMessageId: `demo.${crypto.randomUUID()}` }
  }
  if (!channel.accessTokenCiphertext || !channel.accessTokenIv || !channel.accessTokenTag) {
    throw new CrmApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'El canal de WhatsApp todavía no tiene credenciales.')
  }

  const accessToken = decryptSecret({
    ciphertext: channel.accessTokenCiphertext,
    iv: channel.accessTokenIv,
    tag: channel.accessTokenTag,
  })

  if (channel.provider === 'YCLOUD') {
    const from = normalizeE164(channel.displayPhoneNumber)
    const to = normalizeE164(recipientWaId)
    if (!from || !to) {
      throw new CrmApiError(409, 'YCLOUD_PHONE_INVALID', 'El canal de YCloud necesita números válidos en formato internacional.')
    }
    let response: Response
    try {
      response = await fetcher('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly', {
        method: 'POST',
        headers: { 'X-API-Key': accessToken, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          from,
          to,
          type: 'text',
          text: { body: text, preview_url: false },
          ...(replyToWaMessageId ? { context: { message_id: replyToWaMessageId } } : {}),
          ...(clientMessageId ? { externalId: clientMessageId } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new CrmApiError(502, 'YCLOUD_UNAVAILABLE', 'YCloud no respondió a tiempo. Intentá enviar nuevamente.')
    }
    const result = await response.json().catch(() => ({})) as {
      id?: string
      wamid?: string
      whatsappMessage?: { id?: string; wamid?: string }
      error?: { message?: string; whatsappApiError?: { message?: string } }
    }
    const providerMessageId = result.wamid || result.whatsappMessage?.wamid || result.id || result.whatsappMessage?.id
    if (!response.ok || !providerMessageId) {
      const detail = String(result.error?.whatsappApiError?.message || result.error?.message || '').replace(/\s+/g, ' ').slice(0, 240)
      throw new CrmApiError(502, 'WHATSAPP_SEND_FAILED', detail || 'YCloud rechazó el mensaje.')
    }
    return { providerMessageId }
  }

  if (!channel.phoneNumberId) {
    throw new CrmApiError(409, 'META_PHONE_ID_MISSING', 'El canal de Meta no tiene Phone Number ID.')
  }
  const response = await fetcher(
    `https://graph.facebook.com/${encodeURIComponent(channel.graphApiVersion)}/${encodeURIComponent(channel.phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientWaId,
        type: 'text',
        text: { preview_url: false, body: text },
        ...(replyToWaMessageId ? { context: { message_id: replyToWaMessageId } } : {}),
      }),
    },
  )
  const result = await response.json() as { messages?: Array<{ id: string }>; error?: { code?: number; message?: string } }
  if (!response.ok || !result.messages?.[0]?.id) {
    throw new CrmApiError(502, 'WHATSAPP_SEND_FAILED', result.error?.message || 'Meta rechazó el mensaje.')
  }
  return { providerMessageId: result.messages[0].id }
}

export async function markWhatsAppMessageRead(
  channel: ChannelCredentials,
  waMessageId: string,
  fetcher: typeof fetch = fetch,
) {
  if (isWhatsAppMockEnabled()) return { providerMarked: false, simulated: true }
  if (!channel.accessTokenCiphertext || !channel.accessTokenIv || !channel.accessTokenTag) {
    throw new CrmApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'El canal de WhatsApp todavía no tiene credenciales.')
  }
  const accessToken = decryptSecret({
    ciphertext: channel.accessTokenCiphertext,
    iv: channel.accessTokenIv,
    tag: channel.accessTokenTag,
  })

  if (channel.provider === 'YCLOUD') {
    let response: Response
    try {
      response = await fetcher(`https://api.ycloud.com/v2/whatsapp/inboundMessages/${encodeURIComponent(waMessageId)}/markAsRead`, {
        method: 'POST',
        headers: { 'X-API-Key': accessToken, Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      })
    } catch {
      throw new CrmApiError(502, 'YCLOUD_UNAVAILABLE', 'YCloud no respondió al confirmar la lectura.')
    }
    if (!response.ok) throw new CrmApiError(502, 'WHATSAPP_READ_FAILED', 'YCloud no pudo confirmar la lectura del mensaje.')
    return { providerMarked: true, simulated: false }
  }

  if (!channel.phoneNumberId) {
    throw new CrmApiError(409, 'META_PHONE_ID_MISSING', 'El canal de Meta no tiene Phone Number ID.')
  }
  const response = await fetcher(
    `https://graph.facebook.com/${encodeURIComponent(channel.graphApiVersion)}/${encodeURIComponent(channel.phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: waMessageId }),
    },
  )
  if (!response.ok) throw new CrmApiError(502, 'WHATSAPP_READ_FAILED', 'Meta no pudo confirmar la lectura del mensaje.')
  return { providerMarked: true, simulated: false }
}
