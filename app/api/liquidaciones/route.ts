import { NextResponse } from 'next/server'
import { PayrollService } from '@/lib/services/payroll.service'

// POST /api/liquidaciones — Crear liquidación
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const liquidacion = await PayrollService.ejecutarLiquidacion(body)
        return NextResponse.json(liquidacion, { status: 201 })
    } catch (error: any) {
        console.error('Error procesando liquidacion:', error)
        return NextResponse.json({ error: `Error en la liquidación: ${error.message || 'Error interno'}` }, { status: 500 })
    }
}

// GET /api/liquidaciones — Listar liquidaciones del empleado
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId') || undefined
        const periodo = searchParams.get('periodo') || undefined
        const incluirAnuladas = searchParams.get('incluirAnuladas') === 'true'
        const liquidaciones = await PayrollService.findLiquidaciones(empleadoId, periodo, incluirAnuladas)
        return NextResponse.json(liquidaciones)
    } catch (error) {
        console.error('Error listando liquidaciones:', error)
        return NextResponse.json({ error: 'Error al listar liquidaciones' }, { status: 500 })
    }
}

// Las liquidaciones forman parte del historial contable y no se eliminan.
export async function DELETE() {
    return NextResponse.json({
        error: 'Las liquidaciones no se eliminan. Usá la acción de anulación trazable.',
    }, { status: 405 })
}
