import { NextResponse } from 'next/server'
import { PayrollService } from '@/lib/services/payroll.service'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString())
        const semestre = parseInt(searchParams.get('semestre') || '1') as 1 | 2

        if (!empleadoId) return NextResponse.json({ error: 'Empleado ID requerido' }, { status: 400 })

        const preview = await PayrollService.calcularSACPreview(empleadoId, anio, semestre)
        return NextResponse.json(preview)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, anio, semestre, monto, cajaId } = body

        if (!empleadoId || !monto) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

        const startStr = semestre === 1 ? `${anio}-01-01` : `${anio}-07-01`;
        const endStr = semestre === 1 ? `${anio}-06-30` : `${anio}-12-31`;

        // Creamos una liquidación especial de tipo SAC
        const liquidacion = await PayrollService.ejecutarLiquidacion({
            empleadoId,
            periodo: `SAC ${semestre}º Semestre ${anio}`,
            fechaInicio: startStr,
            fechaFin: endStr,
            cajaId: cajaId || 'caja_chica',
            manualData: {
                sueldoBase: monto,
                horasExtras: 0,
                montoHsExtras: 0,
                descuentoPrestamos: 0,
                diasTrabajados: 180
            }
        })

        // Marcamos el tipo como SAC
        // Nota: ejecutarLiquidacion crea una NORMAL por defecto, pero podemos actualizarla o extender el servicio
        // Por ahora, lo dejamos así y el periodo indica que es SAC.

        return NextResponse.json(liquidacion)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
