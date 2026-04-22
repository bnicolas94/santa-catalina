import { NextResponse } from 'next/server'
import { AsistenciaService } from '@/lib/services/asistencia.service'

// GET /api/fichadas — Lista fichadas (con opción de filtrado)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId') || undefined
        const mes = searchParams.get('mes') || undefined

        const fichadas = await AsistenciaService.findFichadas({ empleadoId, mes })
        return NextResponse.json(fichadas)
    } catch (error) {
        console.error('Error fetching fichadas:', error)
        return NextResponse.json({ error: 'Error al obtener fichadas' }, { status: 500 })
    }
}

// POST /api/fichadas — Crear fichada manual
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const fichada = await AsistenciaService.crearFichadaManual(body)
        return NextResponse.json(fichada, { status: 201 })
    } catch (error: any) {
        console.error('Error creating fichada:', error)
        return NextResponse.json({ error: error.message || 'Error al registrar fichada' }, { status: 500 })
    }
}
