import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const desde = searchParams.get('desde')
        const hasta = searchParams.get('hasta')

        if (!desde || !hasta) {
            return NextResponse.json({ error: 'Parámetros desde y hasta son requeridos' }, { status: 400 })
        }

        const fechaInicio = new Date(`${desde}T00:00:00.000Z`)
        const fechaFin = new Date(`${hasta}T23:59:59.999Z`)

        const liquidaciones = await prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: {
                    gte: fechaInicio,
                    lte: fechaFin
                }
            },
            include: {
                empleado: true
            },
            orderBy: [
                { empleado: { nombre: 'asc'} },
                { fechaGeneracion: 'asc' }
            ]
        })

        // Map the data for easier consumption in the frontend
        const reporte = liquidaciones.map(liq => {
            const totalEgresos = liq.descuentosPrestamos
            const totalIngresos = liq.sueldoProporcional + liq.montoHorasNormales + liq.montoHorasExtras + liq.montoHorasFeriado
            
            return {
                id: liq.id,
                empleado: `${liq.empleado.nombre} ${liq.empleado.apellido || ''}`.trim(),
                periodo: liq.periodo,
                fechaGeneracion: liq.fechaGeneracion,
                totalBruto: totalIngresos,
                descuentos: totalEgresos,
                totalNeto: liq.totalNeto
            }
        })

        return NextResponse.json(reporte)
    } catch (error) {
        console.error('Error fetching liquidaciones reporte:', error)
        return NextResponse.json({ error: 'Error al obtener reporte de liquidaciones' }, { status: 500 })
    }
}
