import { NextRequest } from 'next/server'
import { CrmApiError, apiErrorResponse } from '@/lib/api'
import { conversationVisibilityWhere } from '@/lib/conversations/access'
import { crmPrisma } from '@/lib/prisma'
import { requireCrmUser } from '@/lib/session'
import { downloadWhatsAppImage } from '@/lib/whatsapp/media'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; messageId: string }> }) {
  try {
    const user = await requireCrmUser(request)
    const { id, messageId } = await context.params
    const message = await crmPrisma.message.findFirst({
      where: { id: messageId, conversationId: id, type: 'IMAGE', conversation: conversationVisibilityWhere(user) },
      include: { conversation: { include: { channel: true } } },
    })
    if (!message) throw new CrmApiError(404, 'IMAGE_NOT_FOUND', 'La imagen no existe o no tenés acceso a esta conversación.')
    const image = await downloadWhatsAppImage(message.conversation.channel, message)
    return new Response(new Uint8Array(image.bytes), { headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(image.bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } })
  } catch (error) { return apiErrorResponse(error) }
}
