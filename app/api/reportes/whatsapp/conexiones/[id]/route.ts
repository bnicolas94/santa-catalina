import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') {
        return NextResponse.json({ error: 'Sólo ADMIN puede revocar una conexión' }, { status: 403 })
    }
    const { id } = await context.params
    await prisma.whatsappStatsSource.updateMany({ where: { id }, data: { activo: false } })
    return NextResponse.json({ ok: true })
}
