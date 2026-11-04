import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { validarCandidato } from '@/lib/evaluacion-candidatos/reglas'
import { estadoInvitacion } from '@/lib/evaluacion-candidatos/reglas'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id } = await context.params
    const candidato = await prisma.candidatoEvaluacion.findUnique({ where: { id }, include: {
        invitaciones: { orderBy: { createdAt: 'desc' }, include: { intento: { include: { respuestas: true, resultado: true } } } },
    } })
    if (!candidato) return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 })
    return NextResponse.json({ ...candidato, invitaciones: candidato.invitaciones.map(i => ({ ...i, tokenHash: undefined, estado: estadoInvitacion(i) })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id } = await context.params
    let input: unknown
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const accion = (input as Record<string, unknown>).accion
    if (accion === 'archivar') {
        const resultado = await prisma.$transaction(async tx => {
            const cambiado = await tx.candidatoEvaluacion.updateMany({ where: { id, archivadoAt: null }, data: { archivadoAt: new Date(), archivadoPorId: auth.id! } })
            if (cambiado.count) await tx.invitacionEvaluacion.updateMany({ where: { candidatoId: id, revocadaAt: null, venceAt: { gt: new Date() } }, data: { revocadaAt: new Date(), revocadaPorId: auth.id! } })
            return cambiado
        })
        return NextResponse.json({ ok: resultado.count === 1 }, { status: resultado.count ? 200 : 409 })
    }
    try {
        const datos = validarCandidato(input)
        const resultado = await prisma.candidatoEvaluacion.updateMany({ where: { id, archivadoAt: null }, data: datos })
        return NextResponse.json({ ok: resultado.count === 1 }, { status: resultado.count ? 200 : 404 })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Datos inválidos' }, { status: 400 })
    }
}
