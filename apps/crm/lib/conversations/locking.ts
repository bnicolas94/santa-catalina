import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@/generated/prisma'
import { CrmApiError } from '../api'

export const LOCK_LEASE_SECONDS = 75

type LockRow = {
  id: string
  assignedToId: string | null
  activeById: string | null
  lockToken: string | null
  lockExpiresAt: Date | null
  lockVersion: number
}

export type AcquiredLock = {
  conversationId: string
  assignedToId: string
  activeById: string
  token: string
  expiresAt: string
  version: number
}

function lockFromRow(row: LockRow): AcquiredLock {
  if (!row.assignedToId || !row.activeById || !row.lockToken || !row.lockExpiresAt) {
    throw new CrmApiError(500, 'INVALID_LOCK_STATE', 'El bloqueo quedó en un estado inválido.')
  }
  return {
    conversationId: row.id,
    assignedToId: row.assignedToId,
    activeById: row.activeById,
    token: row.lockToken,
    expiresAt: row.lockExpiresAt.toISOString(),
    version: row.lockVersion,
  }
}

type LockDatabase = PrismaClient | Prisma.TransactionClient

export async function claimConversation(prisma: LockDatabase, conversationId: string, agentId: string) {
  const token = randomUUID()
  const rows = await prisma.$queryRaw<LockRow[]>`
    UPDATE "crm"."conversations"
    SET "assigned_to_id" = ${agentId},
        "active_by_id" = ${agentId},
        "lock_token" = ${token},
        "lock_expires_at" = NOW() + (${LOCK_LEASE_SECONDS} * INTERVAL '1 second'),
        "lock_version" = "lock_version" + 1,
        "status" = 'OPEN'::"crm"."ConversationStatus",
        "updated_at" = NOW()
    WHERE "id" = ${conversationId}
      AND ("assigned_to_id" IS NULL OR "assigned_to_id" = ${agentId})
      AND (
        "active_by_id" IS NULL
        OR "active_by_id" = ${agentId}
        OR "lock_expires_at" < NOW()
      )
    RETURNING
      "id",
      "assigned_to_id" AS "assignedToId",
      "active_by_id" AS "activeById",
      "lock_token" AS "lockToken",
      "lock_expires_at" AS "lockExpiresAt",
      "lock_version" AS "lockVersion"
  `

  if (rows.length === 0) {
    const current = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, assignedToId: true, activeById: true, lockExpiresAt: true },
    })
    if (!current) throw new CrmApiError(404, 'CONVERSATION_NOT_FOUND', 'La conversación no existe.')
    if (current.assignedToId && current.assignedToId !== agentId) {
      throw new CrmApiError(409, 'CONVERSATION_ASSIGNED', 'La conversación está asignada a otra persona.')
    }
    throw new CrmApiError(409, 'CONVERSATION_LOCKED', 'Otra persona tiene activa esta conversación.')
  }

  return lockFromRow(rows[0])
}

export async function heartbeatConversation(
  prisma: LockDatabase,
  conversationId: string,
  agentId: string,
  token: string,
) {
  const rows = await prisma.$queryRaw<LockRow[]>`
    UPDATE "crm"."conversations"
    SET "lock_expires_at" = NOW() + (${LOCK_LEASE_SECONDS} * INTERVAL '1 second'),
        "updated_at" = NOW()
    WHERE "id" = ${conversationId}
      AND "assigned_to_id" = ${agentId}
      AND "active_by_id" = ${agentId}
      AND "lock_token" = ${token}
      AND "lock_expires_at" > NOW()
    RETURNING
      "id",
      "assigned_to_id" AS "assignedToId",
      "active_by_id" AS "activeById",
      "lock_token" AS "lockToken",
      "lock_expires_at" AS "lockExpiresAt",
      "lock_version" AS "lockVersion"
  `

  if (rows.length === 0) {
    throw new CrmApiError(409, 'LOCK_LOST', 'El bloqueo venció o fue transferido. Actualizá la conversación.')
  }
  return lockFromRow(rows[0])
}

export async function releaseConversation(
  prisma: LockDatabase,
  conversationId: string,
  agentId: string,
  token: string,
) {
  const result = await prisma.conversation.updateMany({
    where: { id: conversationId, assignedToId: agentId, activeById: agentId, lockToken: token },
    data: { activeById: null, lockToken: null, lockExpiresAt: null },
  })
  if (result.count === 0) throw new CrmApiError(409, 'LOCK_LOST', 'El bloqueo ya no pertenece a este usuario.')
}

export function isLeaseOwned(input: {
  assignedToId: string | null
  activeById: string | null
  lockToken: string | null
  lockExpiresAt: Date | null
}, agentId: string, token: string, now = new Date()) {
  return input.assignedToId === agentId
    && input.activeById === agentId
    && input.lockToken === token
    && Boolean(input.lockExpiresAt && input.lockExpiresAt > now)
}
