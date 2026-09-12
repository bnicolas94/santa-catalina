import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { ejecutarAutomaticoMP } from '@/lib/services/mercadopago-automatico.service'

export const maxDuration = 60

export async function GET(req: Request) {
    const authorization = authorizeCronRequest(req)
    if (!authorization.authorized) {
        return NextResponse.json({ error: authorization.error }, { status: authorization.status })
    }
    try {
        const resultado = await ejecutarAutomaticoMP()
        return NextResponse.json({ success: !resultado.error && resultado.configurado, ...resultado }, { status: resultado.error || !resultado.configurado ? 502 : 200 })
    } catch (error) {
        console.error('[Cron Mercado Pago] Error de sincronización:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Error de sincronización.' }, { status: 502 })
    }
}
