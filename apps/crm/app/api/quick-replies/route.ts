import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { normalizeQuickReplyInput } from '@/lib/quick-replies'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    await requireCrmUser(request, includeInactive)
    const replies = await crmPrisma.quickReply.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ title: 'asc' }, { shortcut: 'asc' }],
      take: 100,
      select: { id: true, shortcut: true, title: true, body: true, active: true },
    })
    return NextResponse.json(replies)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCrmUser(request, true)
    const input = normalizeQuickReplyInput(await request.json())
    const duplicate = await crmPrisma.quickReply.findUnique({ where: { shortcut: input.shortcut }, select: { id: true } })
    if (duplicate) {
      return NextResponse.json({ error: `Ya existe la respuesta /${input.shortcut}.`, code: 'SHORTCUT_EXISTS' }, { status: 409 })
    }
    const reply = await crmPrisma.quickReply.create({
      data: { ...input, createdById: user.id },
      select: { id: true, shortcut: true, title: true, body: true, active: true },
    })
    return NextResponse.json(reply, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
