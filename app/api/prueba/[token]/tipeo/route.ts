import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TIPEO_SEGUNDOS } from '@/lib/postulaciones/habilidades'
import { DURACION_MINUTOS } from '@/lib/postulaciones/prueba'
import { hashToken, tokenValido } from '@/lib/postulaciones/token'

type Context = { params: Promise<{ token: string }> }
const headers = { 'Cache-Control': 'no-store, private' }

async function buscar(context: Context) {
    const { token } = await context.params
    return tokenValido(token) ? prisma.pruebaPostulante.findUnique({ where: { tokenHash: hashToken(token) } }) : null
}

function disponible(prueba: NonNullable<Awaited<ReturnType<typeof buscar>>>) {
    return prueba.version === 3 && !!prueba.inicioAt && !prueba.entregaAt && !prueba.anuladaAt && Date.now() < prueba.inicioAt.getTime() + DURACION_MINUTOS * 60_000
}

async function leerTexto(request: Request) {
    const body = await request.text()
    if (body.length > 2500) throw new Error('El texto es demasiado largo')
    const input = JSON.parse(body) as Record<string, unknown>
    if (typeof input.texto !== 'string' || input.texto.length > 2000) throw new Error('Texto inválido')
    return input.texto
}

export async function POST(_request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba || !disponible(prueba)) return NextResponse.json({ error: 'La prueba no está disponible' }, { status: 409, headers })
    if (!prueba.tipeoInicioAt) {
        await prisma.pruebaPostulante.updateMany({ where: { id: prueba.id, version: 3, tipeoInicioAt: null, entregaAt: null, anuladaAt: null, inicioAt: { not: null, gt: new Date(Date.now() - DURACION_MINUTOS * 60_000) } }, data: { tipeoInicioAt: new Date() } })
    }
    const actual = await prisma.pruebaPostulante.findUniqueOrThrow({ where: { id: prueba.id }, select: { tipeoInicioAt: true, tipeoFinAt: true, tipeoTexto: true } })
    return NextResponse.json(actual, { headers })
}

export async function PATCH(request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba || !disponible(prueba) || !prueba.tipeoInicioAt || prueba.tipeoFinAt) return NextResponse.json({ error: 'El tipeo ya terminó' }, { status: 409, headers })
    let texto
    try { texto = await leerTexto(request) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Texto inválido' }, { status: 400, headers }) }
    try {
        const result = await prisma.pruebaPostulante.updateMany({ where: { id: prueba.id, tipeoFinAt: null, tipeoInicioAt: { not: null, gt: new Date(Date.now() - TIPEO_SEGUNDOS * 1000) }, entregaAt: null, anuladaAt: null }, data: { tipeoTexto: texto } })
        return NextResponse.json({ ok: result.count === 1 }, { status: result.count === 1 ? 200 : 409, headers })
    } catch (error) { console.error('No se pudo guardar el tipeo:', error); return NextResponse.json({ error: 'No se pudo guardar el tipeo' }, { status: 500, headers }) }
}

export async function PUT(request: Request, context: Context) {
    const prueba = await buscar(context)
    if (!prueba || !disponible(prueba) || !prueba.tipeoInicioAt) return NextResponse.json({ error: 'El tipeo no está disponible' }, { status: 409, headers })
    if (prueba.tipeoFinAt) return NextResponse.json({ tipeoFinAt: prueba.tipeoFinAt, tipeoTexto: prueba.tipeoTexto }, { headers })
    const now = new Date()
    const limite = new Date(prueba.tipeoInicioAt.getTime() + TIPEO_SEGUNDOS * 1000)
    let texto
    try { if (now <= limite) texto = await leerTexto(request) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Texto inválido' }, { status: 400, headers }) }
    try {
        const data = texto === undefined ? { tipeoFinAt: limite } : { tipeoTexto: texto, tipeoFinAt: now }
        await prisma.pruebaPostulante.updateMany({ where: { id: prueba.id, tipeoFinAt: null, entregaAt: null, anuladaAt: null }, data })
        const actual = await prisma.pruebaPostulante.findUniqueOrThrow({ where: { id: prueba.id }, select: { tipeoFinAt: true, tipeoTexto: true } })
        return NextResponse.json(actual, { headers })
    } catch (error) { console.error('No se pudo finalizar el tipeo:', error); return NextResponse.json({ error: 'No se pudo finalizar el tipeo' }, { status: 500, headers }) }
}
