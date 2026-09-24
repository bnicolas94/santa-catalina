import { NextResponse } from 'next/server'
import { listarMovimientosUniformes } from '@/lib/services/uniformes.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar movimientos.' }, { status: 403 })
    try {
        return NextResponse.json(await listarMovimientosUniformes())
    } catch {
        return NextResponse.json({ error: 'No se pudieron consultar los movimientos.' }, { status: 500 })
    }
}
