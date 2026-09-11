import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { getErpEmployeeReferences } from '@/lib/erp/client'
import { argentinaMetricsRange, completeDailyConversationSeries } from '@/lib/metrics'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

type DailyRow = { day: string; conversations: number }
type AgentRow = { agentId: string; conversations: number; messages: number }
type CountRow = { total: number }

export async function GET(request: NextRequest) {
  try {
    const user = await requireCrmUser(request, true)
    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 7)
    const range = argentinaMetricsRange(requestedDays)

    const [dailyRows, agentRows, answeredRows, queueRows, resolved, scheduled, paidScheduled, complaintTags] = await Promise.all([
      crmPrisma.$queryRaw<DailyRow[]>`
        SELECT
          TO_CHAR((COALESCE(message."provider_timestamp", message."created_at") AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS "day",
          COUNT(DISTINCT conversation."contact_id")::int AS "conversations"
        FROM "crm"."messages" message
        INNER JOIN "crm"."conversations" conversation ON conversation."id" = message."conversation_id"
        WHERE message."direction" = 'INBOUND'
          AND COALESCE(message."provider_timestamp", message."created_at") >= ${range.from}
          AND COALESCE(message."provider_timestamp", message."created_at") < ${range.to}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      crmPrisma.$queryRaw<AgentRow[]>`
        SELECT
          "sent_by_id" AS "agentId",
          COUNT(DISTINCT "conversation_id")::int AS "conversations",
          COUNT(*)::int AS "messages"
        FROM "crm"."messages"
        WHERE "direction" = 'OUTBOUND'
          AND "sent_by_id" IS NOT NULL
          AND COALESCE("provider_timestamp", "created_at") >= ${range.from}
          AND COALESCE("provider_timestamp", "created_at") < ${range.to}
        GROUP BY "sent_by_id"
        ORDER BY "conversations" DESC, "messages" DESC
      `,
      crmPrisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT outbound."conversation_id")::int AS "total"
        FROM "crm"."messages" outbound
        WHERE outbound."direction" = 'OUTBOUND'
          AND outbound."sent_by_id" IS NOT NULL
          AND COALESCE(outbound."provider_timestamp", outbound."created_at") >= ${range.from}
          AND COALESCE(outbound."provider_timestamp", outbound."created_at") < ${range.to}
          AND EXISTS (
            SELECT 1 FROM "crm"."messages" inbound
            WHERE inbound."conversation_id" = outbound."conversation_id"
              AND inbound."direction" = 'INBOUND'
              AND COALESCE(inbound."provider_timestamp", inbound."created_at") >= ${range.from}
              AND COALESCE(inbound."provider_timestamp", inbound."created_at") < ${range.to}
          )
      `,
      crmPrisma.conversation.groupBy({ by: ['status'], _count: { _all: true } }),
      crmPrisma.conversation.count({ where: { resolvedAt: { gte: range.from, lt: range.to } } }),
      crmPrisma.scheduledOrder.count({ where: { scheduledAt: { gte: range.from, lt: range.to } } }),
      crmPrisma.scheduledOrder.count({ where: { scheduledAt: { gte: range.from, lt: range.to }, orderPaid: true } }),
      crmPrisma.tag.findMany({
        where: { OR: [{ name: { contains: 'queja', mode: 'insensitive' } }, { name: { contains: 'reclamo', mode: 'insensitive' } }] },
        select: { id: true },
      }),
    ])

    const complaintTagIds = complaintTags.map(tag => tag.id)
    const complaints = complaintTagIds.length > 0
      ? (await crmPrisma.conversationTag.findMany({
        where: { tagId: { in: complaintTagIds }, createdAt: { gte: range.from, lt: range.to } },
        distinct: ['conversationId'],
        select: { conversationId: true },
      })).length
      : 0

    const names = new Map<string, string>([[user.id, user.name]])
    if (process.env.NODE_ENV !== 'production') {
      names.set('agent-marina', 'Marina Soto')
      names.set('agent-lucia', 'Lucía Rojas')
      names.set('agent-admin', 'Administración')
    } else if (agentRows.length > 0) {
      try {
        const employees = await getErpEmployeeReferences(agentRows.map(row => row.agentId), request.headers.get('cookie') || '')
        employees.forEach(employee => names.set(employee.id, employee.name))
      } catch (error) {
        console.error('[CRM metrics agents]', error)
      }
    }

    const daily = completeDailyConversationSeries(range.from, range.days, dailyRows)
    const queue = new Map(queueRows.map(row => [row.status, row._count._all]))
    const totalReceived = daily.reduce((total, item) => total + item.conversations, 0)

    return NextResponse.json({
      period: { days: range.days, from: daily[0]?.day, to: daily.at(-1)?.day },
      generatedAt: new Date().toISOString(),
      received: {
        today: daily.at(-1)?.conversations || 0,
        total: totalReceived,
        dailyAverage: Number((totalReceived / range.days).toFixed(1)),
        daily,
      },
      operators: agentRows.map(row => ({
        agentId: row.agentId,
        name: names.get(row.agentId) || 'Agente no disponible',
        conversations: Number(row.conversations),
        messages: Number(row.messages),
      })),
      answeredConversations: Number(answeredRows[0]?.total || 0),
      queue: {
        unassigned: queue.get('UNASSIGNED') || 0,
        open: queue.get('OPEN') || 0,
        waitingCustomer: queue.get('WAITING_CUSTOMER') || 0,
      },
      resolved,
      scheduledOrders: { total: scheduled, paid: paidScheduled },
      complaints: { total: complaints, mode: complaintTagIds.length > 0 ? 'MANUAL_TAG' : 'PENDING_AI' },
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
