import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ErrorUniformes } from '@/lib/rrhh/uniformes'
import { listarStockUniformes, registrarMovimientoStockUniforme } from '@/lib/services/uniformes.service'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar el stock.' }, { status: 403 })
    try {
        return NextResponse.json(await listarStockUniformes())
    } catch {
        return NextResponse.json({ error: 'No se pudo consultar el stock.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; rol?: string } | undefined
    if (!user?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede modificar el stock.' }, { status: 403 })
    try {
        return NextResponse.json(await registrarMovimientoStockUniforme(await request.json(), user.id), { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'No se pudo actualizar el stock.' },
            { status: error instanceof ErrorUniformes ? error.status : 500 },
        )
    }
}
