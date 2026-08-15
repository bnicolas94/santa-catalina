import { createHash } from 'node:crypto'
import type { MessageStatus, Prisma } from '@/generated/prisma'
import { CrmApiError } from '../api'

type WhatsAppMessage = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: { id?: string; mime_type?: string; caption?: string }
  audio?: { id?: string; mime_type?: string }
  video?: { id?: string; mime_type?: string; caption?: string }
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string }
}

type WhatsAppStatus = {
  id?: string
  status?: string
  timestamp?: string
  errors?: Array<{ code?: number; title?: string; message?: string }>
}

type ParsedWebhook = {
  phoneNumberId: string
  profileName?: string
  messages: WhatsAppMessage[]
  statuses: WhatsAppStatus[]
}

export function parseWhatsAppWebhook(value: unknown): ParsedWebhook {
  if (!value || typeof value !== 'object') throw new CrmApiError(400, 'INVALID_WEBHOOK', 'El webhook no es válido.')
  const payload = value as {
    object?: string
    entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }>
  }
  if (payload.object !== 'whatsapp_business_account') {
    throw new CrmApiError(400, 'INVALID_WEBHOOK_OBJECT', 'El webhook no pertenece a WhatsApp Business.')
  }

  const changes = (payload.entry || []).flatMap(entry => entry.changes || []).filter(change => change.field === 'messages')
  const firstValue = changes[0]?.value
  const metadata = firstValue?.metadata as { phone_number_id?: string } | undefined
  const phoneNumberId = String(metadata?.phone_number_id || '')
  if (!phoneNumberId) throw new CrmApiError(400, 'PHONE_NUMBER_ID_MISSING', 'El webhook no informa el Phone Number ID.')

  const contacts = firstValue?.contacts as Array<{ profile?: { name?: string } }> | undefined
  return {
    phoneNumberId,
    profileName: contacts?.[0]?.profile?.name,
    messages: changes.flatMap(change => Array.isArray(change.value?.messages) ? change.value.messages as WhatsAppMessage[] : []),
    statuses: changes.flatMap(change => Array.isArray(change.value?.statuses) ? change.value.statuses as WhatsAppStatus[] : []),
  }
}

export function webhookPayloadHash(rawBody: string) {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

function providerDate(timestamp?: string) {
  const seconds = Number(timestamp)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date()
}

function inboundContent(message: WhatsAppMessage) {
  const media = message.image || message.audio || message.video || message.document
  const supported = new Set(['text', 'image', 'audio', 'video', 'document', 'location', 'contacts'])
  const providerType = supported.has(message.type || '') ? message.type! : 'system'
  return {
    type: providerType === 'contacts' ? 'CONTACT' : providerType.toUpperCase() as 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | 'CONTACT' | 'SYSTEM',
    body: message.text?.body || null,
    mediaId: media?.id || null,
    mimeType: media?.mime_type || null,
    fileName: message.document?.filename || null,
    caption: message.image?.caption || message.video?.caption || message.document?.caption || null,
  }
}

const STATUS_MAP: Record<string, MessageStatus | undefined> = {
  sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED',
}
const STATUS_RANK: Record<MessageStatus, number> = {
  RECEIVED: 0, QUEUED: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5,
}

export async function persistWhatsAppWebhook(
  transaction: Prisma.TransactionClient,
  channelId: string,
  event: ParsedWebhook,
) {
  for (const message of event.messages) {
    if (!message.id || !message.from) continue
    const existing = await transaction.message.findUnique({ where: { waMessageId: message.id }, select: { id: true } })
    if (existing) continue

    const digits = message.from.replace(/\D/g, '')
    const contact = await transaction.contact.upsert({
      where: { waId: message.from },
      update: { profileName: event.profileName || undefined, displayName: event.profileName || undefined },
      create: {
        waId: message.from,
        phoneE164: `+${digits}`,
        profileName: event.profileName || null,
        displayName: event.profileName || `WhatsApp ${digits.slice(-4)}`,
      },
    })
    const receivedAt = providerDate(message.timestamp)
    const serviceWindowExpiresAt = new Date(receivedAt.getTime() + 24 * 60 * 60 * 1000)
    const conversation = await transaction.conversation.upsert({
      where: { channelId_contactId: { channelId, contactId: contact.id } },
      update: {
        lastMessageAt: receivedAt,
        lastInboundAt: receivedAt,
        serviceWindowExpiresAt,
        unreadCount: { increment: 1 },
        status: 'OPEN',
      },
      create: {
        channelId,
        contactId: contact.id,
        status: 'UNASSIGNED',
        lastMessageAt: receivedAt,
        lastInboundAt: receivedAt,
        serviceWindowExpiresAt,
        unreadCount: 1,
      },
    })
    await transaction.message.create({
      data: {
        conversationId: conversation.id,
        waMessageId: message.id,
        direction: 'INBOUND',
        status: 'RECEIVED',
        providerTimestamp: receivedAt,
        ...inboundContent(message),
      },
    })
  }

  for (const statusEvent of event.statuses) {
    if (!statusEvent.id) continue
    const nextStatus = STATUS_MAP[statusEvent.status || '']
    if (!nextStatus) continue
    const message = await transaction.message.findUnique({ where: { waMessageId: statusEvent.id } })
    if (!message || STATUS_RANK[nextStatus] <= STATUS_RANK[message.status]) continue
    const providerError = statusEvent.errors?.[0]
    await transaction.message.update({
      where: { id: message.id },
      data: {
        status: nextStatus,
        errorCode: providerError?.code ? String(providerError.code) : undefined,
        errorMessage: providerError?.message || providerError?.title || undefined,
      },
    })
  }
}
