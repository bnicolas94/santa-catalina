import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { getAvailableProductCatalog } from '@/lib/erp/client'
import { requireCrmUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request)
    const catalog = await getAvailableProductCatalog(request.headers.get('cookie') || '')
    return NextResponse.json(catalog, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
