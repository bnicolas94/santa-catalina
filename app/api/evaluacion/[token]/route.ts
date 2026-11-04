import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken, tokenValido } from '@/lib/postulaciones/token'
import { invitacionAccesible, validarDemo } from '@/lib/evaluacion-candidatos/reglas'

type Context = { params: Promise<{ token: string }> }
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const rechazo = () => NextResponse.json({ error: 'El enlace no está disponible. Solicitá una nueva invitación.' }, { status: 404, headers })

async function tokenHash(context: Context) {
    const { token } = await context.params
    return tokenValido(token) ? hashToken(token) : null
}

export async function GET(_request: Request, context: Context) {
    const hash = await tokenHash(context)
    if (!hash) return rechazo()
    const invitacion = await prisma.invitacionEvaluacion.findUnique({ where: { tokenHash: hash }, include: {
        candidato: { select: { nombre: true, archivadoAt: true } },
        intento: { include: { respuestas: { where: { modulo: 'DEMO' }, select: { datos: true } } } },
    } })
    if (!invitacion || !invitacionAccesible(invitacion)) return rechazo()
    return NextResponse.json({ nombre: invitacion.candidato.nombre, estado: invitacion.intento?.estado ?? 'NO_INICIADO', inicioAt: invitacion.intento?.inicioAt ?? null, finAt: invitacion.intento?.finAt ?? null, texto: (invitacion.intento?.respuestas[0]?.datos as { texto?: string } | undefined)?.texto ?? '' }, { headers })
}

async function operar(context: Context, accion: 'iniciar' | 'guardar' | 'finalizar', input?: unknown) {
    const hash = await tokenHash(context)
    if (!hash) return rechazo()
    let datos: { texto: string } | null = null
    if (accion === 'guardar' || accion === 'finalizar') {
        try { datos = validarDemo(input) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Respuesta inválida' }, { status: 400, headers }) }
    }
    try {
        const resultado = await prisma.$transaction(async tx => {
            const filas = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "invitaciones_evaluacion" WHERE "token_hash" = ${hash} FOR UPDATE`
            if (!filas.length) return null
            const inv = await tx.invitacionEvaluacion.findUnique({ where: { id: filas[0].id }, include: { candidato: { select: { archivadoAt: true } }, intento: true } })
            if (!inv || !invitacionAccesible(inv)) return null
            if (accion === 'iniciar') {
                if (inv.intento) return { estado: inv.intento.estado, inicioAt: inv.intento.inicioAt }
                const intento = await tx.intentoEvaluacion.create({ data: { invitacionId: inv.id } })
                return { estado: intento.estado, inicioAt: intento.inicioAt }
            }
            if (!inv.intento) return { error: 'Primero comenzá la evaluación', status: 409 }
            if (accion === 'guardar') {
                if (inv.intento.estado !== 'EN_PROGRESO') return { error: 'La demostración ya fue finalizada', status: 409 }
                await tx.respuestaEvaluacion.upsert({ where: { intentoId_modulo: { intentoId: inv.intento.id, modulo: 'DEMO' } }, create: { intentoId: inv.intento.id, modulo: 'DEMO', datos: datos! }, update: { datos: datos! } })
                return { estado: 'EN_PROGRESO', texto: datos!.texto }
            }
            if (inv.intento.estado === 'COMPLETADO') return { estado: 'COMPLETADO', finAt: inv.intento.finAt }
            await tx.respuestaEvaluacion.upsert({ where: { intentoId_modulo: { intentoId: inv.intento.id, modulo: 'DEMO' } }, create: { intentoId: inv.intento.id, modulo: 'DEMO', datos: datos! }, update: { datos: datos! } })
            const intento = await tx.intentoEvaluacion.update({ where: { id: inv.intento.id }, data: { estado: 'COMPLETADO', finAt: new Date() } })
            return { estado: intento.estado, finAt: intento.finAt }
        })
        if (!resultado) return rechazo()
        if ('error' in resultado) return NextResponse.json({ error: resultado.error }, { status: resultado.status, headers })
        return NextResponse.json(resultado, { headers })
    } catch {
        return NextResponse.json({ error: 'No se pudo guardar. Intentá de nuevo.' }, { status: 500, headers })
    }
}

export async function POST(request: Request, context: Context) {
    let input: unknown
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Aceptá las condiciones para comenzar' }, { status: 400, headers }) }
    if (!input || typeof input !== 'object' || (input as Record<string, unknown>).acepta !== true) return NextResponse.json({ error: 'Aceptá las condiciones para comenzar' }, { status: 400, headers })
    return operar(context, 'iniciar')
}

export async function PATCH(request: Request, context: Context) {
    let input: unknown
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400, headers }) }
    return operar(context, 'guardar', input)
}

export async function PUT(request: Request, context: Context) {
    let input: unknown
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400, headers }) }
    return operar(context, 'finalizar', input)
}
