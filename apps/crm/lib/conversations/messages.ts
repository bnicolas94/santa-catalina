import type { PrismaClient } from '@/generated/prisma'
import { CrmApiError } from '../api'
import { sendWhatsAppText } from '../whatsapp/provider'
import { isLeaseOwned } from './locking'

type SendTextInput = {
  conversationId: string
  agentId: string
  lockToken: string
  clientMessageId: string
  text: string
  replyToWaMessageId?: string | null
}

export async function sendConversationText(prisma: PrismaClient, input: SendTextInput) {
  const prepared = await prisma.$transaction(async transaction => {
    const existing = await transaction.message.findUnique({ where: { clientMessageId: input.clientMessageId } })
    if (existing) return { message: existing, duplicate: true, channel: null, recipientWaId: null }

    await transaction.$queryRaw`
      SELECT "id" FROM "crm"."conversations"
      WHERE "id" = ${input.conversationId}
      FOR UPDATE
    `
    const conversation = await transaction.conversation.findUnique({
      where: { id: input.conversationId },
      include: { channel: true, contact: true },
    })
    if (!conversation) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
    if (conversation.status === 'RESOLVED' || conversation.status === 'ARCHIVED') {
      throw new CrmApiError(409, 'CONVERSATION_CLOSED', 'La conversación está cerrada.')
    }
    if (!isLeaseOwned(conversation, input.agentId, input.lockToken)) {
      throw new CrmApiError(409, 'LOCK_LOST', 'No podés responder porque el bloqueo venció o pertenece a otra persona.')
    }

    const message = await transaction.message.create({
      data: {
        conversationId: conversation.id,
        clientMessageId: input.clientMessageId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        status: 'QUEUED',
        body: input.text,
        replyToWaMessageId: input.replyToWaMessageId,
        sentById: input.agentId,
      },
    })
    await transaction.conversation.update({
      where: { id: conversation.id },
      data: { status: 'OPEN', lastMessageAt: new Date(), lastOutboundAt: new Date() },
    })
    return { message, duplicate: false, channel: conversation.channel, recipientWaId: conversation.contact.waId }
  })

  if (prepared.duplicate || !prepared.channel || !prepared.recipientWaId) return prepared.message

  try {
    const sent = await sendWhatsAppText(prepared.channel, prepared.recipientWaId, input.text, input.replyToWaMessageId)
    return await prisma.message.update({
      where: { id: prepared.message.id },
      data: { waMessageId: sent.providerMessageId, status: 'SENT' },
    })
  } catch (error) {
    await prisma.message.update({
      where: { id: prepared.message.id },
      data: {
        status: 'FAILED',
        errorCode: error instanceof CrmApiError ? error.code : 'PROVIDER_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido del proveedor',
      },
    })
    throw error
  }
}
