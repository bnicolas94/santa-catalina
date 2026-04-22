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
        const liquidaciones = await PayrollService.findLiquidaciones(empleadoId)
        return NextResponse.json(liquidaciones)
    } catch (error) {
        console.error('Error listando liquidaciones:', error)
        return NextResponse.json({ error: 'Error al listar liquidaciones' }, { status: 500 })
    }
}

// DELETE /api/liquidaciones — Revertir liquidación
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de liquidación requerido' }, { status: 400 })
        }

        const result = await PayrollService.revertirLiquidacion(id)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error eliminando liquidación:', error)
        return NextResponse.json({ error: error.message || 'Error al eliminar la liquidación' }, { status: 500 })
    }
}
