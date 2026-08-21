import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReportesMetadata } from '@/lib/services/reportes'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!tienePermisoEnSesion(session, 'permisoReportes')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const data = await getReportesMetadata()
        return NextResponse.json(data)

    } catch (error) {
        console.error('Error obteniendo metadata de reportes:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
