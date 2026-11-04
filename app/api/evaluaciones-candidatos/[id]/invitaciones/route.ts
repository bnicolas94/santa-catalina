import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { hashToken, tokenNuevo } from '@/lib/postulaciones/token'
import { vigenciaDias } from '@/lib/evaluacion-candidatos/reglas'

type Context = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Context) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const { id } = await context.params
    const token = tokenNuevo()
    const ahora = new Date()
    const venceAt = new Date(ahora.getTime() + vigenciaDias() * 86_400_000)
    try {
        const invitacion = await prisma.$transaction(async tx => {
            const filas = await tx.$queryRaw<Array<{ id: string; archivado_at: Date | null }>>`SELECT "id", "archivado_at" FROM "candidatos_evaluacion" WHERE "id" = ${id} FOR UPDATE`
            if (!filas.length || filas[0].archivado_at) throw new Error('Candidato no disponible')
            const vigente = await tx.invitacionEvaluacion.findFirst({ where: { candidatoId: id, revocadaAt: null, venceAt: { gt: ahora } } })
            if (vigente) throw new Error('Ya tiene un enlace vigente. Revocalo antes de generar otro.')
            return tx.invitacionEvaluacion.create({ data: { candidatoId: id, tokenHash: hashToken(token), venceAt, creadaPorId: auth.id! } })
        })
        return NextResponse.json({ id: invitacion.id, token, venceAt }, { status: 201, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo generar la invitación' }, { status: 409 })
    }
}
