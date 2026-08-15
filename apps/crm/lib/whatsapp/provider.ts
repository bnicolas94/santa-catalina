import { CrmApiError } from '../api'
import { decryptSecret } from '../secrets'

type ChannelCredentials = {
  phoneNumberId: string
  graphApiVersion: string
  accessTokenCiphertext: string | null
  accessTokenIv: string | null
  accessTokenTag: string | null
}

export function isWhatsAppMockEnabled(env: { NODE_ENV?: string; CRM_MOCK_WHATSAPP?: string } = process.env) {
  return env.CRM_MOCK_WHATSAPP === 'true'
    || (env.NODE_ENV !== 'production' && env.CRM_MOCK_WHATSAPP !== 'false')
}

export async function sendWhatsAppText(
  channel: ChannelCredentials,
  recipientWaId: string,
  text: string,
  replyToWaMessageId?: string | null,
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
  const response = await fetch(
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
