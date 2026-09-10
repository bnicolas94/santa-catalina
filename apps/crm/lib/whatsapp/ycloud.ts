import { CrmApiError } from '../api'
import { normalizeE164 } from './provider'
import type { HistoryThread, ParsedWebhook, WhatsAppMessage, WhatsAppStatus } from './webhook'

type YCloudMessage = {
  id?: string
  wamid?: string
  externalId?: string
  wabaId?: string
  from?: string
  to?: string
  sendTime?: string
  createTime?: string
  updateTime?: string
  status?: string
  errorCode?: string | number
  errorMessage?: string
  customerProfile?: { name?: string; username?: string }
  type?: string
  text?: { body?: string }
  image?: Record<string, unknown>
  audio?: Record<string, unknown>
  video?: Record<string, unknown>
  document?: Record<string, unknown>
  location?: Record<string, unknown>
  contacts?: unknown[]
  context?: { id?: string; message_id?: string }
}

type YCloudPayload = {
  id?: string
  type?: string
  createTime?: string
  whatsappInboundMessage?: YCloudMessage
  whatsappMessage?: YCloudMessage
}

export type ParsedYCloudWebhook = {
  eventId: string
  wabaId: string | null
  businessPhone: string | null
  event: ParsedWebhook
}

function messageId(message: YCloudMessage) {
  return message.wamid || message.id
}

function mapMessage(message: YCloudMessage): WhatsAppMessage {
  return {
    id: messageId(message),
    externalId: message.externalId,
    from: message.from,
    to: message.to,
    timestamp: message.sendTime || message.createTime || message.updateTime,
    type: message.type,
    text: message.text,
    image: message.image as WhatsAppMessage['image'],
    audio: message.audio as WhatsAppMessage['audio'],
    video: message.video as WhatsAppMessage['video'],
    document: message.document as WhatsAppMessage['document'],
    context: message.context,
  }
}

function mapStatus(message: YCloudMessage): WhatsAppStatus {
  return {
    id: messageId(message),
    alternateId: message.wamid && message.id && message.wamid !== message.id ? message.id : undefined,
    externalId: message.externalId,
    status: message.status,
    timestamp: message.updateTime || message.sendTime || message.createTime,
    errors: message.errorCode || message.errorMessage ? [{
      code: typeof message.errorCode === 'number' ? message.errorCode : undefined,
      title: message.errorCode ? String(message.errorCode) : undefined,
      message: message.errorMessage,
    }] : undefined,
  }
}

export function parseYCloudWebhook(value: unknown): ParsedYCloudWebhook {
  if (!value || typeof value !== 'object') throw new CrmApiError(400, 'INVALID_WEBHOOK', 'El webhook de YCloud no es válido.')
  const payload = value as YCloudPayload
  if (!payload.id || !payload.type) throw new CrmApiError(400, 'INVALID_YCLOUD_EVENT', 'El evento de YCloud no informa ID y tipo.')

  const inbound = payload.whatsappInboundMessage
  const outbound = payload.whatsappMessage
  const source = inbound || outbound
  if (!source) {
    throw new CrmApiError(400, 'YCLOUD_MESSAGE_MISSING', 'El evento de YCloud no contiene un mensaje de WhatsApp.')
  }
  const wabaId = source.wabaId || null
  const businessPhone = inbound?.to || outbound?.from || null
  if (payload.type !== 'whatsapp.message.updated' && (!wabaId || !businessPhone)) {
    throw new CrmApiError(400, 'YCLOUD_CHANNEL_MISSING', 'El evento de YCloud no identifica el WABA y el número del negocio.')
  }

  const messages: WhatsAppMessage[] = []
  const echoes: WhatsAppMessage[] = []
  const statuses: WhatsAppStatus[] = []
  const historyThreads: HistoryThread[] = []
  const mapped = mapMessage(source)

  if (payload.type === 'whatsapp.inbound_message.received' && inbound) {
    messages.push(mapped)
  } else if (payload.type === 'whatsapp.message.updated' && outbound) {
    statuses.push(mapStatus(outbound))
  } else if (payload.type === 'whatsapp.smb.message.echoes' && outbound) {
    echoes.push(mapped)
  } else if (payload.type === 'whatsapp.smb.history') {
    const contactPhone = inbound?.from || outbound?.to
    if (contactPhone) historyThreads.push({ id: contactPhone, messages: [mapped] })
  } else {
    throw new CrmApiError(400, 'YCLOUD_EVENT_UNSUPPORTED', `El evento ${payload.type} no está habilitado en el CRM.`)
  }

  return {
    eventId: payload.id,
    wabaId,
    businessPhone: businessPhone ? normalizeE164(businessPhone) || businessPhone : null,
    event: {
      wabaId,
      phoneNumberId: null,
      profileName: inbound?.customerProfile?.name || inbound?.customerProfile?.username,
      messages,
      statuses,
      echoes,
      historyThreads,
      syncedContacts: [],
      accountUpdates: [],
    },
  }
}

type YCloudPhoneNumber = {
  phoneNumber?: string
  displayPhoneNumber?: string
  verifiedName?: string
  qualityRating?: string
  status?: string
  error?: { message?: string }
}

export async function validateYCloudChannel(input: {
  wabaId: string
  phoneNumber: string
  apiKey: string
}, fetcher: typeof fetch = fetch) {
  const phoneNumber = normalizeE164(input.phoneNumber)
  if (!phoneNumber) throw new CrmApiError(400, 'INVALID_PHONE_NUMBER', 'El número debe tener formato internacional, por ejemplo +5491112345678.')
  const url = `https://api.ycloud.com/v2/whatsapp/phoneNumbers/${encodeURIComponent(input.wabaId)}/${encodeURIComponent(phoneNumber)}`
  let response: Response
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: { 'X-API-Key': input.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new CrmApiError(502, 'YCLOUD_UNAVAILABLE', 'YCloud no respondió a tiempo. Intentá validar nuevamente.')
  }
  const result = await response.json().catch(() => ({})) as YCloudPhoneNumber
  if (!response.ok) {
    const detail = String(result.error?.message || '').replace(/\s+/g, ' ').slice(0, 240)
    throw new CrmApiError(502, 'YCLOUD_VALIDATION_FAILED', detail || `YCloud rechazó la validación (HTTP ${response.status}).`)
  }
  return {
    phoneNumberId: null,
    displayPhoneNumber: normalizeE164(result.phoneNumber || result.displayPhoneNumber) || phoneNumber,
    verifiedName: result.verifiedName || null,
    qualityRating: result.qualityRating || null,
    platformType: 'CLOUD_API',
    isOnBizApp: true,
    providerStatus: result.status || null,
  }
}
