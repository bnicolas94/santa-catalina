import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request)
    const replies = await crmPrisma.quickReply.findMany({
      where: { active: true },
      orderBy: [{ title: 'asc' }, { shortcut: 'asc' }],
      take: 100,
      select: { id: true, shortcut: true, title: true, body: true },
    })
    return NextResponse.json(replies)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
