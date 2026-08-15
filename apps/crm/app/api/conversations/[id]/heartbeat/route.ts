import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, requireText } from '@/lib/api'
import { heartbeatConversation } from '@/lib/conversations/locking'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id } = await context.params
    const body = await request.json()
    const token = requireText(body.lockToken, 'lockToken', 100)
    const lock = await heartbeatConversation(crmPrisma, id, user.id, token)
    return NextResponse.json({ lock })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
