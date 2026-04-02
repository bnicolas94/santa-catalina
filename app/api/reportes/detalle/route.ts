import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReporteDetalle } from '@/lib/services/reportes'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user as any).rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const tipo = searchParams.get('tipo') as 'pedidos' | 'gastos' | 'lotes'
        const mes = parseInt(searchParams.get('mes') || '0')
        const anio = parseInt(searchParams.get('anio') || '0')
        const ubicacionId = searchParams.get('ubicacionId') || undefined
        const categoriaId = searchParams.get('categoriaId') || undefined

        if (!tipo || !mes || !anio) {
            return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 })
        }

        const data = await getReporteDetalle(tipo, mes, anio, ubicacionId, categoriaId)
        return NextResponse.json(data)

    } catch (error) {
        console.error('Error detallando reporte:', error)
        return NextResponse.json({ error: 'Error detallando reporte' }, { status: 500 })
    }
}
