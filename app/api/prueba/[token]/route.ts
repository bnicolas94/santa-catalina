import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DURACION_MINUTOS, validarRespuestas, vencePrueba } from '@/lib/postulaciones/prueba'
import { hashToken, tokenValido } from '@/lib/postulaciones/token'

type Context = { params: Promise<{ token: string }> }
const noStore = { 'Cache-Control': 'no-store, private' }

async function leerRespuesta(request: Request) {
    if (!request.body) throw new Error('Faltan respuestas')
    const reader = request.body.getReader()
    const decoder = new TextDecoder()
    let body = ''
    let bytes = 0
    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > 30_000) { await reader.cancel(); throw new Error('Las respuestas son demasiado largas') }
        body += decoder.decode(value, { stream: true })
    }
    return body + decoder.decode()
}

async function buscar(context: Context) {
    const { token } = await context.params
    if (!tokenValido(token)) return null
    return prisma.pruebaPostulante.findUnique({ where: { tokenHash: hashToken(token) } })
}

export async function GET(_request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404, headers: noStore })
    const now = new Date()
    const estado = prueba.anuladaAt ? 'anulada' : prueba.entregaAt ? 'entregada'
        : prueba.inicioAt ? (now > vencePrueba(prueba.inicioAt) ? 'agotada' : 'iniciada')
            : now > prueba.venceAt ? 'vencida' : 'pendiente'
    return NextResponse.json({ nombre: prueba.nombre, version: prueba.version, estado, inicioAt: prueba.inicioAt, limiteAt: prueba.inicioAt ? vencePrueba(prueba.inicioAt) : null }, { headers: noStore })
}

export async function POST(_request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404, headers: noStore })
    const now = new Date()
    if (!prueba.inicioAt) {
        await prisma.pruebaPostulante.updateMany({ where: { id: prueba.id, inicioAt: null, entregaAt: null, anuladaAt: null, venceAt: { gt: now } }, data: { inicioAt: now } })
    }
    return GET(_request, context)
}

export async function PUT(request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404, headers: noStore })
    if (prueba.anuladaAt || prueba.entregaAt || !prueba.inicioAt || new Date() > vencePrueba(prueba.inicioAt)) {
        return NextResponse.json({ error: 'La prueba ya no admite entregas' }, { status: 409, headers: noStore })
    }
    let respuestas
    try {
        respuestas = validarRespuestas(JSON.parse(await leerRespuesta(request)))
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Respuestas inválidas' }, { status: 400, headers: noStore })
    }
    const entregaAt = new Date()
    const result = await prisma.pruebaPostulante.updateMany({
        where: { id: prueba.id, inicioAt: { not: null, gt: new Date(entregaAt.getTime() - DURACION_MINUTOS * 60_000) }, entregaAt: null, anuladaAt: null },
        data: { respuestas, entregaAt },
    })
    if (!result.count) return NextResponse.json({ error: 'La prueba ya no admite entregas' }, { status: 409, headers: noStore })
    return NextResponse.json({ ok: true }, { headers: noStore })
}
