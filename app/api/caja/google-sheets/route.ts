import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { guardarConfiguracionSheetCaja, guardarSucursalesSheet, resumenGoogleSheetsCaja, sincronizarGoogleSheetsCaja } from '@/lib/services/google-sheets-caja.service'

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
    try { return NextResponse.json(await resumenGoogleSheetsCaja()) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo consultar la integración.' }, { status: 503 }) }
}

export async function PATCH(request: Request) {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await request.json()
        if (body.sucursales !== undefined) await guardarSucursalesSheet(body.sucursales, usuario.id)
        if (body.config !== undefined) await guardarConfiguracionSheetCaja(body.config, usuario.id)
        return NextResponse.json(await resumenGoogleSheetsCaja())
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar la integración.' }, { status: 400 })
    }
}

export async function POST() {
    const usuario = await exigirAdmin(); if (usuario instanceof NextResponse) return usuario
    try { return NextResponse.json(await sincronizarGoogleSheetsCaja(true)) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo sincronizar.' }, { status: 502 }) }
}
