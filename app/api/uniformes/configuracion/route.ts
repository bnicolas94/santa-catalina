import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ErrorUniformes } from '@/lib/rrhh/uniformes'
import { consultarConfiguracionUniformes, guardarConfiguracionUniformes } from '@/lib/rrhh/uniformes-config'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede consultar la configuración.' }, { status: 403 })
    try {
        return NextResponse.json(await consultarConfiguracionUniformes())
    } catch {
        return NextResponse.json({ error: 'No se pudo consultar la configuración.' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { rol?: string } | undefined
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
    if (user.rol !== 'ADMIN') return NextResponse.json({ error: 'Sólo ADMIN puede configurar la constancia.' }, { status: 403 })
    try {
        return NextResponse.json(await guardarConfiguracionUniformes(await request.json()))
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof ErrorUniformes ? error.message : 'No se pudo guardar la configuración.' },
            { status: error instanceof ErrorUniformes ? error.status : 500 },
        )
    }
}
