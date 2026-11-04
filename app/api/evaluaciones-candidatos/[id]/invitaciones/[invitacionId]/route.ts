import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'

type Context = { params: Promise<{ id: string; invitacionId: string }> }

export async function PATCH(_request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id, invitacionId } = await context.params
    const resultado = await prisma.invitacionEvaluacion.updateMany({ where: { id: invitacionId, candidatoId: id, revocadaAt: null }, data: { revocadaAt: new Date(), revocadaPorId: auth.id! } })
    return NextResponse.json({ ok: resultado.count === 1 }, { status: resultado.count ? 200 : 409 })
}
