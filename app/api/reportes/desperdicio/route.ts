import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDesperdicioReport } from '@/lib/services/reportes-desperdicio'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const date = new Date()
        const mes = parseInt(searchParams.get('mes') || String(date.getMonth() + 1))
        const anio = parseInt(searchParams.get('anio') || String(date.getFullYear()))
        const ubicacionId = searchParams.get('ubicacionId') || undefined

        const data = await getDesperdicioReport(mes, anio, ubicacionId)

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error calculando reporte desperdicio:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
