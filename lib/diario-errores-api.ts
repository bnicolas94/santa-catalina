import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { DiarioError } from '@/lib/diario-errores'

export async function autorizarDiario(admin = false) {
    const session = await getServerSession(authOptions)
    const user = session?.user as { id?: string; name?: string; rol?: string } | undefined
    if (!user?.id) return { rechazo: NextResponse.json({ error: 'Sesión requerida' }, { status: 401 }) }
    if (!tienePermisoEnSesion(session, 'permisoDiarioErrores') || (admin && user.rol !== 'ADMIN')) return { rechazo: NextResponse.json({ error: 'No tenés permiso para esta acción' }, { status: 403 }) }
    return { user }
}

export function errorDiario(error: unknown) {
    if (error instanceof DiarioError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 409 })
        if (error.code === 'P2025') return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
        if (error.code === 'P2034') return NextResponse.json({ error: 'Hubo un cambio simultáneo. Volvé a intentar.' }, { status: 409 })
    }
    console.error('Error en diario de errores:', error)
    return NextResponse.json({ error: 'No se pudo completar la operación. Intentá nuevamente.' }, { status: 500 })
}
