import { NextResponse } from 'next/server'
import { PayrollService } from '@/lib/services/payroll.service'
import { fechasDeRangoVacaciones } from '@/lib/payroll/vacaciones'
import { instanteRRHH } from '@/lib/rrhh/fechas'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const anio = parseInt(searchParams.get('anio') || new Date().getFullYear().toString())

        if (!empleadoId) return NextResponse.json({ error: 'Empleado ID requerido' }, { status: 400 })

        const preview = await PayrollService.calcularVacacionesPreview(empleadoId, anio)
        return NextResponse.json(preview)
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo calcular vacaciones.' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, anio, monto, dias, cajaId, fechaInicioGoce, fechaFinGoce } = body

        if (!empleadoId || !Number.isFinite(Number(monto)) || Number(monto) <= 0) {
            return NextResponse.json({ error: 'El empleado y el monto son obligatorios.' }, { status: 400 })
        }
        if (!fechaInicioGoce || !fechaFinGoce) {
            return NextResponse.json({ error: 'Indicá las fechas de inicio y fin del goce de vacaciones.' }, { status: 400 })
        }

        let fechasVacaciones: string[]
        try {
            fechasVacaciones = fechasDeRangoVacaciones(fechaInicioGoce, fechaFinGoce)
        } catch (error: unknown) {
            return NextResponse.json({ error: error instanceof Error ? error.message : 'El período de vacaciones es inválido.' }, { status: 400 })
        }

        // Creamos una liquidación especial de tipo VACACIONES
        const liquidacion = await PayrollService.ejecutarLiquidacion({
            empleadoId,
            periodo: `Vacaciones ${anio} (${dias} días)`,
            fechaInicio: fechaInicioGoce,
            fechaFin: fechaFinGoce,
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
            },
            estadosDiarios: fechasVacaciones.map(fecha => ({
                fecha: instanteRRHH(fecha),
                tipo: 'VACACIONES',
                motivo: 'Vacaciones',
                observaciones: `Registrado al liquidar vacaciones ${anio}`,
            })),
        })

        return NextResponse.json(liquidacion)
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo liquidar vacaciones.' }, { status: 500 })
    }
}
