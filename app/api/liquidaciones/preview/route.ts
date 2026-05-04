import { NextResponse } from 'next/server'
import { PayrollService } from '@/lib/services/payroll.service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoIds, fechaInicio, fechaFin } = body

        if (!empleadoIds || !Array.isArray(empleadoIds) || !fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const resultados = await Promise.all(
            empleadoIds.map(async (id) => {
                try {
                    return await PayrollService.calcularSueldoSemanal(id, fechaInicio, fechaFin)
                } catch (err: any) {
                    return { empleadoId: id, error: err.message }
                }
            })
        )

        return NextResponse.json(resultados)
    } catch (error) {
        console.error('Error in liquidacion preview:', error)
        return NextResponse.json({ error: 'Error al procesar la previsualización' }, { status: 500 })
    }
}
