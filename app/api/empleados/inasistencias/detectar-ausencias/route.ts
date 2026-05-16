import { NextResponse } from 'next/server'
import { AsistenciaService } from '@/lib/services/asistencia.service'

export async function POST(request: Request) {
    try {
        const { fecha, desde, hasta } = await request.json()
        
        let creados = 0
        if (desde && hasta) {
            creados = await AsistenciaService.procesarAusenciasRango(desde, hasta)
        } else if (fecha) {
            creados = await AsistenciaService.procesarAusenciasAutomaticas(fecha)
        } else {
            return NextResponse.json({ error: 'Fecha o rango (desde/hasta) requerido' }, { status: 400 })
        }

        return NextResponse.json({ 
            success: true, 
            mensaje: `Se procesaron y registraron ${creados} ausencias en el periodo indicado.` 
        })
    } catch (error) {
        console.error('Error detectando ausencias:', error)
        return NextResponse.json({ error: 'Error interno al procesar ausencias' }, { status: 500 })
    }
}
