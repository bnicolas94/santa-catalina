import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { getAvailablePickupLocations } from '@/lib/erp/client'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request)
    const locations = await getAvailablePickupLocations(request.headers.get('cookie') || '')
    return NextResponse.json(locations, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
