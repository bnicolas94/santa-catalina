import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { consultarFichadoRemoto, FichadoRemotoError, registrarFichadoRemoto } from '@/lib/services/fichado-remoto.service'
import { esAccionFichadoRemoto } from '@/lib/rrhh/fichado-remoto'

async function identidad() {
    const sesion = await getServerSession(authOptions)
    return (sesion?.user as { id?: string } | undefined)?.id
}

function respuestaError(error: unknown) {
    if (error instanceof FichadoRemotoError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Error de fichado remoto:', error)
    return NextResponse.json({ error: 'No se pudo procesar el fichado.' }, { status: 500 })
}

export async function GET() {
    const empleadoId = await identidad()
    if (!empleadoId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    try { return NextResponse.json(await consultarFichadoRemoto(empleadoId)) }
    catch (error) { return respuestaError(error) }
}

export async function POST(request: Request) {
    const empleadoId = await identidad()
    if (!empleadoId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    let body: unknown
    try { body = await request.json() }
    catch { return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
    const accion = typeof body === 'object' && body !== null && 'accion' in body ? body.accion : undefined
    if (!esAccionFichadoRemoto(accion)) return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
    try { return NextResponse.json(await registrarFichadoRemoto(empleadoId, accion), { status: 201 }) }
    catch (error) { return respuestaError(error) }
}
