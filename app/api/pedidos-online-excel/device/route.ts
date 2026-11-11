import { NextResponse } from 'next/server'
import {
    confirmarOperacionPedidosOnlineExcel, operacionesPendientesPedidosOnlineExcel, validarTokenPedidosOnlineExcel,
} from '@/lib/services/pedidos-online-excel.service'

export const dynamic = 'force-dynamic'

async function autorizado(request: Request) {
    return validarTokenPedidosOnlineExcel(request.headers.get('authorization'))
}

export async function GET(request: Request) {
    if (!await autorizado(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    return NextResponse.json(await operacionesPendientesPedidosOnlineExcel(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
    if (!await autorizado(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    try { return NextResponse.json(await confirmarOperacionPedidosOnlineExcel(await request.json())) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Confirmación inválida.' }, { status: 409 }) }
}
