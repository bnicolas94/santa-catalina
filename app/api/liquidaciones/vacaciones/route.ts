import { NextResponse } from 'next/server'
import { PayrollService } from '@/lib/services/payroll.service'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString())

        if (!empleadoId) return NextResponse.json({ error: 'Empleado ID requerido' }, { status: 400 })

        const preview = await PayrollService.calcularVacacionesPreview(empleadoId, anio)
        return NextResponse.json(preview)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, anio, monto, dias, cajaId, fechaInicioGoce, fechaFinGoce } = body

        if (!empleadoId || !monto) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

        // Creamos una liquidación especial de tipo VACACIONES
        const liquidacion = await PayrollService.ejecutarLiquidacion({
            empleadoId,
            periodo: `Vacaciones ${anio} (${dias} días)`,
            fechaInicio: `${anio}-01-01`,
            fechaFin: `${anio}-12-31`,
            cajaId: cajaId || 'caja_chica',
            tipo: 'VACACIONES',
            manualData: {
                sueldoBase: monto,
                horasExtras: 0,
                montoHsExtras: 0,
                descuentoPrestamos: 0,
                diasTrabajados: dias,
                fechaInicioGoce,
                fechaFinGoce,
                esVacaciones: true
            }
        })

        return NextResponse.json(liquidacion)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
