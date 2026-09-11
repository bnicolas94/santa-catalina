import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sincronizarMercadoPago } from '@/lib/services/mercadopago.service'

export const maxDuration = 60

export async function POST() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const usuario = session.user as { id?: string; rol?: string }
    if (usuario.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede sincronizar Mercado Pago.' }, { status: 403 })
    try {
        return NextResponse.json(await sincronizarMercadoPago(usuario.id))
    } catch (error) {
        console.error('[Mercado Pago] Error de sincronización:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron sincronizar los egresos.' }, { status: 502 })
    }
}
