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
        const categoriaId = searchParams.get('categoriaId') || undefined

        if (!tipo || !desdeIso || !hastaIso) {
            return NextResponse.json({ error: 'Parámetros faltantes' }, { status: 400 })
        }

        const todos = searchParams.get('todos') === 'true'
        const data = await getReporteDetalle(tipo, desdeIso, hastaIso, ubicacionId, categoriaId, todos)
        return NextResponse.json(data)

    } catch (error) {
        console.error('Error detallando reporte:', error)
        return NextResponse.json({ error: 'Error detallando reporte' }, { status: 500 })
    }
}
