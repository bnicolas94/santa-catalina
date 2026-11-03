import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { VIGENCIA_DIAS } from '@/lib/postulaciones/prueba'
import { hashToken, tokenNuevo } from '@/lib/postulaciones/token'

export async function GET() {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const pruebas = await prisma.pruebaPostulante.findMany({
        orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, version: true, nombre: true, email: true, venceAt: true, inicioAt: true, entregaAt: true, anuladaAt: true, createdAt: true, revision: true },
    })
    return NextResponse.json(pruebas)
}

export async function POST(request: Request) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    let input: Record<string, unknown>
    try { input = await request.json() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
    const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim() : ''
    if (!nombre || nombre.length > 120 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return NextResponse.json({ error: 'Ingresá un nombre y, si corresponde, un email válido' }, { status: 400 })
    }
    const token = tokenNuevo()
    const prueba = await prisma.pruebaPostulante.create({ data: {
        nombre, email: email || null, version: 2, tokenHash: hashToken(token),
        venceAt: new Date(Date.now() + VIGENCIA_DIAS * 86_400_000), creadoPorId: auth.id!,
    } })
    return NextResponse.json({ id: prueba.id, token }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
