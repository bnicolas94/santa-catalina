import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReportesMetadata } from '@/lib/services/reportes'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const data = await getReportesMetadata()
        return NextResponse.json(data)

    } catch (error) {
        console.error('Error obteniendo metadata de reportes:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
