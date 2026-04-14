import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { detectarDesvios } from '@/lib/services/reportes-alertas'

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

        const alertas = await detectarDesvios(mes, anio, ubicacionId)

        return NextResponse.json(alertas)
    } catch (error) {
        console.error('Error obteniendo alertas:', error)
        return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 })
    }
}
