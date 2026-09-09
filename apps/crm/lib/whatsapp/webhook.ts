import { createHash } from 'node:crypto'
import type { MessageStatus, Prisma } from '@/generated/prisma'
import { CrmApiError } from '../api'

type WhatsAppMessage = {
  id?: string
  from?: string
  to?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
  image?: { id?: string; mime_type?: string; caption?: string }
  audio?: { id?: string; mime_type?: string }
  video?: { id?: string; mime_type?: string; caption?: string }
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string }
  history_context?: { status?: string }
}

type WhatsAppStatus = {
  id?: string
  status?: string
  timestamp?: string
  errors?: Array<{ code?: number; title?: string; message?: string }>
}

type SyncedContact = {
  type?: string
  action?: string
  contact?: { full_name?: string; first_name?: string; phone_number?: string }
}

type HistoryThread = { id?: string; messages?: WhatsAppMessage[] }
type AccountUpdate = { event?: string; phone_number?: string; disconnection_info?: Record<string, unknown> }

export type ParsedWebhook = {
  wabaId: string | null
  phoneNumberId: string | null
  profileName?: string
  messages: WhatsAppMessage[]
  statuses: WhatsAppStatus[]
  echoes: WhatsAppMessage[]
  historyThreads: HistoryThread[]
  syncedContacts: SyncedContact[]
  accountUpdates: AccountUpdate[]
}

export function parseWhatsAppWebhook(value: unknown): ParsedWebhook {
  if (!value || typeof value !== 'object') throw new CrmApiError(400, 'INVALID_WEBHOOK', 'El webhook no es válido.')
  const payload = value as {
    object?: string
    entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: Record<string, unknown> }> }>
  }
  if (payload.object !== 'whatsapp_business_account') {
    throw new CrmApiError(400, 'INVALID_WEBHOOK_OBJECT', 'El webhook no pertenece a WhatsApp Business.')
  }

  const entries = payload.entry || []
  const changes = entries.flatMap(entry => entry.changes || [])
  const metadataValue = changes.map(change => change.value).find(item => {
    const metadata = item?.metadata as { phone_number_id?: string } | undefined
    return Boolean(metadata?.phone_number_id)
  })
  const metadata = metadataValue?.metadata as { phone_number_id?: string } | undefined
  const phoneNumberId = metadata?.phone_number_id ? String(metadata.phone_number_id) : null
  const accountUpdates = changes
    .filter(change => change.field === 'account_update' && change.value)
    .map(change => change.value as AccountUpdate)
  if (!phoneNumberId && accountUpdates.length === 0) {
    throw new CrmApiError(400, 'PHONE_NUMBER_ID_MISSING', 'El webhook no informa el Phone Number ID.')
  }

  const messageChanges = changes.filter(change => change.field === 'messages')
  const contacts = messageChanges.flatMap(change => Array.isArray(change.value?.contacts)
    ? change.value.contacts as Array<{ profile?: { name?: string } }>
    : [])
  return {
    wabaId: entries.find(entry => entry.id)?.id || null,
    phoneNumberId,
    profileName: contacts[0]?.profile?.name,
    messages: messageChanges.flatMap(change => Array.isArray(change.value?.messages) ? change.value.messages as WhatsAppMessage[] : []),
    statuses: messageChanges.flatMap(change => Array.isArray(change.value?.statuses) ? change.value.statuses as WhatsAppStatus[] : []),
    echoes: changes.filter(change => change.field === 'smb_message_echoes')
      .flatMap(change => Array.isArray(change.value?.message_echoes) ? change.value.message_echoes as WhatsAppMessage[] : []),
    historyThreads: changes.filter(change => change.field === 'history')
      .flatMap(change => Array.isArray(change.value?.history) ? change.value.history as Array<{ threads?: HistoryThread[] }> : [])
      .flatMap(history => history.threads || []),
    syncedContacts: changes.filter(change => change.field === 'smb_app_state_sync')
      .flatMap(change => Array.isArray(change.value?.state_sync) ? change.value.state_sync as SyncedContact[] : []),
    accountUpdates,
  }
}

export function webhookPayloadHash(rawBody: string) {
  return createHash('sha256').update(rawBody, 'utf8').digest('hex')
}

function providerDate(timestamp?: string) {
  const seconds = Number(timestamp)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date()
}

function normalizedWaId(value?: string) {
  return String(value || '').replace(/\D/g, '')
}

function messageContent(message: WhatsAppMessage) {
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

async function upsertContact(transaction: Prisma.TransactionClient, waIdValue: string, displayName?: string | null) {
  const waId = normalizedWaId(waIdValue)
  if (!waId) return null
  return transaction.contact.upsert({
    where: { waId },
    update: displayName ? { profileName: displayName, displayName } : {},
    create: {
      waId,
      phoneE164: `+${waId}`,
      profileName: displayName || null,
      displayName: displayName || `WhatsApp ${waId.slice(-4)}`,
    },
  })
}

async function persistLiveMessage(
  transaction: Prisma.TransactionClient,
  channelId: string,
  message: WhatsAppMessage,
  direction: 'INBOUND' | 'OUTBOUND',
  profileName?: string,
) {
  const contactWaId = direction === 'INBOUND' ? message.from : message.to
  if (!message.id || !contactWaId) return
  const existing = await transaction.message.findUnique({ where: { waMessageId: message.id }, select: { id: true } })
  if (existing) return
  const contact = await upsertContact(transaction, contactWaId, direction === 'INBOUND' ? profileName : null)
  if (!contact) return
  const occurredAt = providerDate(message.timestamp)
  const inbound = direction === 'INBOUND'
  const conversation = await transaction.conversation.upsert({
    where: { channelId_contactId: { channelId, contactId: contact.id } },
    update: {
      lastMessageAt: occurredAt,
      ...(inbound ? {
        lastInboundAt: occurredAt,
        serviceWindowExpiresAt: new Date(occurredAt.getTime() + 24 * 60 * 60 * 1000),
        unreadCount: { increment: 1 },
        status: 'OPEN' as const,
      } : {
        lastOutboundAt: occurredAt,
        status: 'WAITING_CUSTOMER' as const,
      }),
    },
    create: {
      channelId,
      contactId: contact.id,
      status: 'UNASSIGNED',
      lastMessageAt: occurredAt,
      lastInboundAt: inbound ? occurredAt : null,
      lastOutboundAt: inbound ? null : occurredAt,
      serviceWindowExpiresAt: inbound ? new Date(occurredAt.getTime() + 24 * 60 * 60 * 1000) : null,
      unreadCount: inbound ? 1 : 0,
    },
  })
  await transaction.message.create({
    data: {
      conversationId: conversation.id,
      waMessageId: message.id,
      direction,
      status: inbound ? 'RECEIVED' : 'SENT',
      providerTimestamp: occurredAt,
      ...messageContent(message),
    },
  })
  if (!inbound) {
    await transaction.conversationEvent.create({
      data: { conversationId: conversation.id, type: 'WHATSAPP_APP_MESSAGE_ECHO', metadata: { waMessageId: message.id } },
    })
  }
}

async function persistHistoryThread(transaction: Prisma.TransactionClient, channelId: string, thread: HistoryThread) {
  const contactWaId = normalizedWaId(thread.id)
  if (!contactWaId) return
  const contact = await upsertContact(transaction, contactWaId)
  if (!contact) return
  const ordered = [...(thread.messages || [])].sort((left, right) => Number(left.timestamp || 0) - Number(right.timestamp || 0))
  for (const message of ordered) {
    if (!message.id) continue
    const existingMessage = await transaction.message.findUnique({ where: { waMessageId: message.id }, select: { id: true } })
    if (existingMessage) continue
    const occurredAt = providerDate(message.timestamp)
    const inbound = normalizedWaId(message.from) === contactWaId
    let conversation = await transaction.conversation.findUnique({ where: { channelId_contactId: { channelId, contactId: contact.id } } })
    if (!conversation) {
      conversation = await transaction.conversation.create({
        data: {
          channelId, contactId: contact.id, status: 'UNASSIGNED', lastMessageAt: occurredAt,
          lastInboundAt: inbound ? occurredAt : null, lastOutboundAt: inbound ? null : occurredAt,
        },
      })
    } else if (occurredAt > conversation.lastMessageAt) {
      conversation = await transaction.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: occurredAt,
          ...(inbound ? { lastInboundAt: occurredAt } : { lastOutboundAt: occurredAt }),
        },
      })
    }
    await transaction.message.create({
      data: {
        conversationId: conversation.id,
        waMessageId: message.id,
        direction: inbound ? 'INBOUND' : 'OUTBOUND',
        status: inbound ? 'RECEIVED' : STATUS_MAP[message.history_context?.status || ''] || 'SENT',
        providerTimestamp: occurredAt,
        ...messageContent(message),
      },
    })
  }
}

export async function persistWhatsAppWebhook(
  transaction: Prisma.TransactionClient,
  channelId: string,
  event: ParsedWebhook,
) {
  for (const contactEvent of event.syncedContacts) {
    if (contactEvent.type !== 'contact' || !contactEvent.contact?.phone_number) continue
    await upsertContact(transaction, contactEvent.contact.phone_number, contactEvent.contact.full_name || contactEvent.contact.first_name)
  }
  for (const thread of event.historyThreads) await persistHistoryThread(transaction, channelId, thread)
  for (const message of event.messages) await persistLiveMessage(transaction, channelId, message, 'INBOUND', event.profileName)
  for (const echo of event.echoes) await persistLiveMessage(transaction, channelId, echo, 'OUTBOUND')

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

  for (const update of event.accountUpdates) {
    if (update.event === 'PARTNER_REMOVED' || update.event === 'ACCOUNT_OFFBOARDED') {
      await transaction.whatsAppChannel.update({
        where: { id: channelId },
        data: { active: false, connectionStatus: 'DISCONNECTED', isOnBizApp: false, coexistenceVerifiedAt: null, continuityVerifiedAt: null },
      })
    } else if (update.event === 'ACCOUNT_RECONNECTED') {
      await transaction.whatsAppChannel.update({
        where: { id: channelId },
        data: { active: false, connectionStatus: 'PENDING', coexistenceVerifiedAt: null, continuityVerifiedAt: null },
      })
    }
  }
}
