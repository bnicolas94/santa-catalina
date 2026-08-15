import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await requireCrmUser(request))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
