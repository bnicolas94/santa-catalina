import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api'
import { requireCrmUser } from '@/lib/session'
import { encryptionConfigurationStatus } from '@/lib/whatsapp/channels'
import { isWhatsAppMockEnabled } from '@/lib/whatsapp/provider'

export async function GET(request: NextRequest) {
  try {
    await requireCrmUser(request, true)
    const baseUrl = process.env.CRM_BASE_URL || request.nextUrl.origin
    return NextResponse.json({
      encryptionStatus: encryptionConfigurationStatus(),
      mockMode: isWhatsAppMockEnabled(),
      webhookUrl: new URL('/api/webhooks/whatsapp', baseUrl).toString(),
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
