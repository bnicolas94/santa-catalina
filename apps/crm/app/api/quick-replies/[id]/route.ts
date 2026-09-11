import { NextRequest, NextResponse } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { normalizeQuickReplyInput } from '@/lib/quick-replies'
import { requireCrmUser } from '@/lib/session'

const selection = { id: true, shortcut: true, title: true, body: true, active: true } as const

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCrmUser(request, true)
    const { id } = await context.params
    const existing = await crmPrisma.quickReply.findUnique({ where: { id }, select: selection })
    if (!existing) throw new CrmApiError(404, 'QUICK_REPLY_NOT_FOUND', 'La respuesta rápida no existe.')
    const input = normalizeQuickReplyInput(await request.json(), existing)
    const duplicate = await crmPrisma.quickReply.findFirst({
      where: { shortcut: input.shortcut, id: { not: id } },
      select: { id: true },
    })
    if (duplicate) throw new CrmApiError(409, 'SHORTCUT_EXISTS', `Ya existe la respuesta /${input.shortcut}.`)
    const reply = await crmPrisma.quickReply.update({ where: { id }, data: input, select: selection })
    return NextResponse.json(reply)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCrmUser(request, true)
    const { id } = await context.params
    const existing = await crmPrisma.quickReply.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw new CrmApiError(404, 'QUICK_REPLY_NOT_FOUND', 'La respuesta rápida no existe.')
    await crmPrisma.quickReply.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
