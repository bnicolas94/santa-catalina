import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { confirmarReporteMP, previewReporteMP } from '@/lib/services/mercadopago-reporte.service'
import { previewPendientesMP } from '@/lib/services/mercadopago-automatico.service'

export const maxDuration = 60
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const usuario = session.user as { id?: string; rol?: string }
    if (usuario.rol !== 'ADMIN' || !usuario.id) return NextResponse.json({ error: 'Sólo ADMIN puede conciliar Mercado Pago.' }, { status: 403 })
    try {
        const texto = await req.text()
        if (Buffer.byteLength(texto) > 3 * 1024 * 1024) return NextResponse.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })
        const body = JSON.parse(texto)
        if (body.accion === 'pendientes') return NextResponse.json(await previewPendientesMP(usuario.id))
        if (body.accion === 'preview') return NextResponse.json(await previewReporteMP(body.csv, usuario.id))
        if (body.accion === 'confirmar') return NextResponse.json(await confirmarReporteMP(body.token, body.decisiones, usuario.id))
        return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
    } catch (e) {
        if (e && typeof e === 'object' && 'code' in e && String(e.code).startsWith('P')) {
            return NextResponse.json({ error: 'Caja cambió durante la operación o no está disponible. No se aplicó el lote. Volvé a generar la vista previa.' }, { status: 409 })
        }
        return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo procesar el reporte.' }, { status: 400 })
    }
}
