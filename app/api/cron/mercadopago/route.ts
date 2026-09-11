import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { sincronizarMercadoPago } from '@/lib/services/mercadopago.service'

export const maxDuration = 60

export async function GET(req: Request) {
    const authorization = authorizeCronRequest(req)
    if (!authorization.authorized) {
        return NextResponse.json({ error: authorization.error }, { status: authorization.status })
    }
    try {
        const resultado = await sincronizarMercadoPago()
        return NextResponse.json({ success: true, ...resultado })
    } catch (error) {
        console.error('[Cron Mercado Pago] Error de sincronización:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Error de sincronización.' }, { status: 502 })
    }
}
