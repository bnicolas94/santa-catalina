import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@/generated/prisma'
import { parseWhatsAppWebhook, persistWhatsAppWebhook } from './webhook'

for (const assignedToId of [null, 'agent-a', 'agent-b']) {
  test(`un mensaje entrante conserva la asignación ${assignedToId || 'pendiente'} y su estado operativo`, async () => {
    const updates: Array<{ where: Prisma.ConversationWhereInput; data: Prisma.ConversationUpdateManyMutationInput }> = []
    const createdMessages: Prisma.MessageCreateInput[] = []
    const occurredAt = new Date('2026-09-12T19:00:00Z')
    const transaction = {
      contact: { upsert: async () => ({ id: 'contact-1' }) },
      message: {
        findFirst: async () => null,
        create: async ({ data }: { data: Prisma.MessageCreateInput }) => { createdMessages.push(data); return data },
      },
      conversation: {
        upsert: async () => ({ id: 'conversation-1', assignedToId }),
        updateMany: async (update: typeof updates[number]) => { updates.push(update); return { count: 1 } },
      },
    } as unknown as Prisma.TransactionClient
    const event = parseWhatsAppWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: 'phone-1' },
        messages: [{ id: 'wamid.new', from: '5491112345678', timestamp: String(occurredAt.getTime() / 1000), type: 'text', text: { body: 'Hola' } }],
      } }] }],
    })

    await persistWhatsAppWebhook(transaction, 'channel-1', event)

    assert.equal(updates.length, 2)
    assert.deepEqual(updates[1], {
      where: { id: 'conversation-1', lastMessageAt: { lte: occurredAt } },
      data: { lastMessageAt: occurredAt, status: assignedToId ? 'OPEN' : 'UNASSIGNED', resolvedAt: null },
    })
    assert.ok(updates.every(update => !('assignedToId' in update.data)))
    assert.equal(createdMessages.length, 1)
    assert.equal(createdMessages[0].direction, 'INBOUND')
  })
}
