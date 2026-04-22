import { NextResponse } from 'next/server'
import { AsistenciaService } from '@/lib/services/asistencia.service'

// POST /api/fichadas/importar — Procesa carga masiva de fichadas
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { registros } = body

        const result = await AsistenciaService.importarFichadas(registros)

        return NextResponse.json({
            success: result.success,
            mensaje: `Se importaron ${result.importados} fichadas.`,
            errores: result.errores.length > 0 ? result.errores : undefined
        }, { status: 200 })

    } catch (error: any) {
        console.error('Error importing fichadas:', error)
        return NextResponse.json({ error: error.message || 'Error al importar fichadas' }, { status: 500 })
    }
}
