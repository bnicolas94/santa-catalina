import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ErrorUniformes } from '@/lib/rrhh/uniformes'
import { configurarProductoUniforme } from '@/lib/services/uniformes.service'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { rol?: string } | undefined
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede configurar prendas.' }, { status: 403 })
    try {
        const { id } = await params
        return NextResponse.json(await configurarProductoUniforme(id, await request.json()))
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'No se pudo configurar la prenda.' },
            { status: error instanceof ErrorUniformes ? error.status : 500 },
        )
    }
}
