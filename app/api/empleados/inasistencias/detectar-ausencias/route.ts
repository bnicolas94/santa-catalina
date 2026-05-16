import { NextResponse } from 'next/server'
import { AsistenciaService } from '@/lib/services/asistencia.service'

export async function POST(request: Request) {
    try {
        const { fecha } = await request.json()
        
        if (!fecha) {
            return NextResponse.json({ error: 'Fecha requerida (YYYY-MM-DD)' }, { status: 400 })
        }

        const creados = await AsistenciaService.procesarAusenciasAutomaticas(fecha)
        
        return NextResponse.json({ 
            success: true, 
            mensaje: `Se registraron ${creados} ausencias automáticamente para la fecha ${fecha}.` 
        })
    } catch (error) {
        console.error('Error detectando ausencias:', error)
        return NextResponse.json({ error: 'Error interno al procesar ausencias' }, { status: 500 })
    }
}
