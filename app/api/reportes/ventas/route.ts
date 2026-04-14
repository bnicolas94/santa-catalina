import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getVentasReport } from '@/lib/services/reportes-ventas'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const date = new Date()
        let desdeIso = searchParams.get('desde')
        let hastaIso = searchParams.get('hasta')

        if (!desdeIso || !hastaIso) {
            const mes = parseInt(searchParams.get('mes') || String(date.getMonth() + 1))
            const anio = parseInt(searchParams.get('anio') || String(date.getFullYear()))
            desdeIso = new Date(anio, mes - 1, 1).toISOString()
            hastaIso = new Date(anio, mes, 0, 23, 59, 59, 999).toISOString()
        }

        const ubicacionId = searchParams.get('ubicacionId') || undefined

        const data = await getVentasReport(desdeIso, hastaIso, ubicacionId)

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error calculando reporte ventas:', error)
        return NextResponse.json({ error: 'Error calculando reporte' }, { status: 500 })
    }
}
