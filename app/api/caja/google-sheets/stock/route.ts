import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
    cambiarEstadoSheetStock, confirmarDescuentoSheetStock, previsualizarDescuentoSheetStock,
    resumenGoogleSheetsStock, sincronizarGoogleSheetsStock,
} from '@/lib/services/google-sheets-stock.service'

export const maxDuration = 60

async function exigirAdmin() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
    const usuario = session.user as { id?: string; rol?: string }
    if (usuario.rol !== 'ADMIN' || !usuario.id) return NextResponse.json({ error: 'Sólo ADMIN puede administrar esta integración.' }, { status: 403 })
    return usuario as { id: string; rol: string }
}

export async function GET() {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try { return NextResponse.json(await resumenGoogleSheetsStock()) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo consultar el stock del Sheet.' }, { status: 503 }) }
}

export async function PATCH(request: Request) {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await request.json()
        if (typeof body.activo !== 'boolean') return NextResponse.json({ error: 'Indicá si querés activar o pausar la sincronización.' }, { status: 400 })
        await cambiarEstadoSheetStock(body.activo, usuario.id)
        return NextResponse.json(await resumenGoogleSheetsStock())
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' }, { status: 400 }) }
}

export async function POST(request: Request) {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await request.json()
        if (body.accion === 'sincronizar') {
            const resultado = await sincronizarGoogleSheetsStock(true)
            return NextResponse.json(resultado, { status: resultado.error ? 502 : 200 })
        }
        const seleccion = {
            registroId: String(body.registroId || ''), presentacionId: String(body.presentacionId || ''),
            ubicacionId: String(body.ubicacionId || ''), paquetes: Number(body.paquetes),
        }
        if (body.accion === 'previsualizar') return NextResponse.json(await previsualizarDescuentoSheetStock(seleccion))
        if (body.accion === 'confirmar') return NextResponse.json(await confirmarDescuentoSheetStock({
            ...seleccion, huellaStock: String(body.huellaStock || ''), registroUpdatedAt: String(body.registroUpdatedAt || ''),
            stockActual: Number(body.stockActual), stockUpdatedAt: body.stockUpdatedAt === null ? null : String(body.stockUpdatedAt || ''),
        }))
        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo procesar el pedido.' }, { status: 400 }) }
}
