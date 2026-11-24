import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { guardarInsumoVariosSabores, guardarLineaElegidos, mensajeRecetaElegidos, obtenerRecetasElegidos, quitarLineaElegidos } from '@/lib/recetas-elegidos'

type Contexto = { params: Promise<{ id: string }> }

async function permiso() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Iniciá sesión.' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoStock') && !tienePermisoEnSesion(session, 'permisoProduccion')) {
        return NextResponse.json({ error: 'No tenés permiso para gestionar recetas.' }, { status: 403 })
    }
    return null
}

export async function GET(_request: Request, contexto: Contexto) {
    const denegado = await permiso()
    if (denegado) return denegado
    try { return NextResponse.json(await obtenerRecetasElegidos((await contexto.params).id)) }
    catch (error) { return NextResponse.json({ error: mensajeRecetaElegidos(error) }, { status: 400 }) }
}

export async function POST(request: Request, contexto: Contexto) {
    const denegado = await permiso()
    if (denegado) return denegado
    try {
        const body = await request.json()
        const linea = Array.isArray(body?.codigosSabor)
            ? await guardarInsumoVariosSabores((await contexto.params).id, body)
            : await guardarLineaElegidos((await contexto.params).id, body)
        return NextResponse.json(linea, { status: 201 })
    } catch (error) { return NextResponse.json({ error: mensajeRecetaElegidos(error) }, { status: 400 }) }
}

export async function PUT(request: Request, contexto: Contexto) {
    const denegado = await permiso()
    if (denegado) return denegado
    try {
        const body = await request.json()
        const id = String(body.id ?? '')
        if (!id) throw new Error('Elegí la línea de receta a editar.')
        return NextResponse.json(await guardarLineaElegidos((await contexto.params).id, body, id))
    } catch (error) { return NextResponse.json({ error: mensajeRecetaElegidos(error) }, { status: 400 }) }
}

export async function DELETE(request: Request, contexto: Contexto) {
    const denegado = await permiso()
    if (denegado) return denegado
    try {
        const id = new URL(request.url).searchParams.get('id') ?? ''
        if (!id) throw new Error('Elegí la línea de receta a quitar.')
        await quitarLineaElegidos((await contexto.params).id, id)
        return NextResponse.json({ ok: true })
    } catch (error) { return NextResponse.json({ error: mensajeRecetaElegidos(error) }, { status: 400 }) }
}
