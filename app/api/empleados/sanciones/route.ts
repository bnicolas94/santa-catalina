import { NextResponse } from 'next/server'
import { SancionService } from '@/lib/services/sancion.service'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const tipo = searchParams.get('tipo')

        const sanciones = await SancionService.findAll({
            empleadoId: empleadoId || undefined,
            tipo: tipo || undefined
        })

        return NextResponse.json(sanciones)
    } catch (error) {
        console.error('Error fetching sanciones:', error)
        return NextResponse.json({ error: 'Error al obtener sanciones' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fecha, tipo, motivo, observaciones } = body

        if (!empleadoId || !tipo || !motivo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        const sancion = await SancionService.create({
            empleadoId,
            fecha,
            tipo,
            motivo,
            observaciones
        })

        return NextResponse.json(sancion)
    } catch (error) {
        console.error('Error creating sancion:', error)
        return NextResponse.json({ error: 'Error al registrar sanción' }, { status: 500 })
    }
}
