import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { CajaValidationError, type UsuarioCajas } from '@/lib/caja/catalogo'
import { guardarCaja, listarCajas } from '@/lib/services/cajas-catalogo.service'
import { prisma } from '@/lib/prisma'

async function admin() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
    const usuario = session.user as UsuarioCajas
    if (usuario.rol !== 'ADMIN' || !usuario.id) return NextResponse.json({ error: 'Sólo ADMIN puede administrar cajas.' }, { status: 403 })
    return usuario as UsuarioCajas & { id: string }
}
function errorCaja(error: unknown) {
    if (error instanceof CajaValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Esa sede ya tiene una caja de depósitos. Desmarcá la anterior antes de elegir otra.' }, { status: 409 })
        if (error.code === 'P2025') return NextResponse.json({ error: 'Caja no encontrada.' }, { status: 404 })
        if (error.code === 'P2034') return NextResponse.json({ error: 'La caja cambió durante la operación. Actualizá e intentá nuevamente.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo guardar la caja.' }, { status: 500 })
}
export async function GET() {
    const usuario = await admin(); if (usuario instanceof NextResponse) return usuario
    try { return NextResponse.json(await listarCajas(usuario, true)) } catch (e) { return errorCaja(e) }
}
export async function POST(req: Request) {
    const usuario = await admin(); if (usuario instanceof NextResponse) return usuario
    try { return NextResponse.json(await guardarCaja(await req.json(), usuario.id), { status: 201 }) } catch (e) { return errorCaja(e) }
}
export async function PATCH(req: Request) {
    const usuario = await admin(); if (usuario instanceof NextResponse) return usuario
    try {
        const body = await req.json()
        if (typeof body.id !== 'string' || !body.id) throw new CajaValidationError('ID requerido.')
        return NextResponse.json(await guardarCaja(body, usuario.id, body.id))
    } catch (e) { return errorCaja(e) }
}
export async function DELETE(req: Request) {
    const usuario = await admin(); if (usuario instanceof NextResponse) return usuario
    try {
        const id = new URL(req.url).searchParams.get('id')
        if (!id) throw new CajaValidationError('ID requerido.')
        const caja = await prisma.saldoCaja.findUniqueOrThrow({ where: { id } })
        return NextResponse.json(await guardarCaja({ ...caja, activo: false }, usuario.id, id))
    } catch (e) { return errorCaja(e) }
}
