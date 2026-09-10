import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request)
    const tags = await crmPrisma.tag.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    })
    return NextResponse.json(tags)
  } catch (error) {
    return apiErrorResponse(error)
  }
}
