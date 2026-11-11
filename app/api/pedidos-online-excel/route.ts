import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
    activarPedidosOnlineExcel, cancelarPruebaPedidosOnlineExcel, configurarDestinoPedidosOnlineExcel,
    crearPruebaPedidosOnlineExcel, desactivarPedidosOnlineExcel, emitirTokenPedidosOnlineExcel,
    reintentarPedidoOnlineExcel, resumenPedidosOnlineExcel, sincronizarPedidosOnlineExcel,
} from '@/lib/services/pedidos-online-excel.service'

export const maxDuration = 60

async function exigirAdmin() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
    const usuario = session.user as { id?: string; rol?: string }
    if (usuario.rol !== 'ADMIN' || !usuario.id) return NextResponse.json({ error: 'Sólo ADMIN puede administrar esta integración.' }, { status: 403 })
    return usuario.id
}

export async function GET() {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    return NextResponse.json(await resumenPedidosOnlineExcel(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await request.json()
        await configurarDestinoPedidosOnlineExcel(body.workbookName, usuario)
        return NextResponse.json(await resumenPedidosOnlineExcel())
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo configurar.' }, { status: 400 }) }
}

export async function POST(request: Request) {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await request.json()
        switch (body.action) {
            case 'activar': await activarPedidosOnlineExcel(usuario); break
            case 'desactivar': await desactivarPedidosOnlineExcel(usuario); break
            case 'sincronizar': await sincronizarPedidosOnlineExcel(); break
            case 'token': return NextResponse.json({ token: await emitirTokenPedidosOnlineExcel() }, { headers: { 'Cache-Control': 'no-store' } })
            case 'prueba': return NextResponse.json(await crearPruebaPedidosOnlineExcel())
            case 'cancelar-prueba': await cancelarPruebaPedidosOnlineExcel(String(body.id ?? '')); break
            case 'reintentar': await reintentarPedidoOnlineExcel(String(body.id ?? '')); break
            default: return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
        }
        return NextResponse.json(await resumenPedidosOnlineExcel())
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar la acción.' }, { status: 400 }) }
}
