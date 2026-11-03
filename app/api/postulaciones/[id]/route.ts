import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { validarRevision } from '@/lib/postulaciones/prueba'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id } = await context.params
    const prueba = await prisma.pruebaPostulante.findUnique({ where: { id }, select: {
        id: true, nombre: true, email: true, venceAt: true, inicioAt: true, entregaAt: true,
        anuladaAt: true, respuestas: true, revision: true, revisadoAt: true, createdAt: true,
    } })
    if (!prueba) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(prueba, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id } = await context.params
    let input: Record<string, unknown>
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
    if (input.accion === 'anular') {
        const result = await prisma.pruebaPostulante.updateMany({ where: { id, entregaAt: null, anuladaAt: null }, data: { anuladaAt: new Date(), anuladaPorId: auth.id! } })
        return NextResponse.json({ ok: result.count === 1 }, { status: result.count === 1 ? 200 : 409 })
    }
    try {
        const revision = validarRevision(input)
        const result = await prisma.pruebaPostulante.updateMany({ where: { id, entregaAt: { not: null } }, data: { revision, revisadoPorId: auth.id!, revisadoAt: new Date() } })
        return NextResponse.json({ ok: result.count === 1 }, { status: result.count === 1 ? 200 : 409 })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Revisión inválida' }, { status: 400 })
    }
}
