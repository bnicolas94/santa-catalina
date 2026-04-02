import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getProduccionReport } from '@/lib/services/reportes'
import { revalidateTag } from 'next/cache'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const mesParam = searchParams.get('mes')
        const anioParam = searchParams.get('anio')
        const ubicacionId = searchParams.get('ubicacionId') || undefined
        const refresh = searchParams.get('refresh') === 'true'

        if (refresh) {
            revalidateTag('reportes', 'default')
        }

        const date = new Date()
        const anio = anioParam ? parseInt(anioParam) : date.getFullYear()
        const mes = mesParam ? parseInt(mesParam) : date.getMonth() + 1

        const data = await getProduccionReport(mes, anio, ubicacionId)

        return NextResponse.json(data)

    } catch (error) {
        console.error('Error calculando reporte producción:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
