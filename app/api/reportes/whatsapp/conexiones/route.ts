import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') {
        return NextResponse.json({ error: 'Sólo ADMIN puede conectar una computadora' }, { status: 403 })
    }
    let nombre = ''
    try { nombre = String((await request.json()).nombre || '').trim() } catch { /* entrada inválida */ }
    if (nombre.length < 2 || nombre.length > 80) {
        return NextResponse.json({ error: 'Ingresá un nombre de 2 a 80 caracteres' }, { status: 400 })
    }
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const source = await prisma.whatsappStatsSource.create({ data: { nombre, tokenHash } })
    return NextResponse.json({ id: source.id, nombre: source.nombre, token },
        { headers: { 'Cache-Control': 'no-store' } })
}
