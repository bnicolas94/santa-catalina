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

        const [liquidaciones, liquidacionesFinales] = await Promise.all([
            prisma.liquidacionSueldo.findMany({
                where: {
                    fechaGeneracion: {
                        gte: fechaInicio,
                        lte: fechaFin
                    },
                    estado: 'pagado'
                },
                include: {
                    empleado: true,
                    items: true
                },
                orderBy: [
                    { empleado: { nombre: 'asc'} },
                    { fechaGeneracion: 'asc' }
                ]
            }),
            prisma.liquidacionFinal.findMany({
                where: {
                    fechaEgreso: {
                        gte: fechaInicio,
                        lte: fechaFin
                    }
                },
                include: {
                    empleado: true
                },
                orderBy: {
                    fechaEgreso: 'asc'
                }
            })
        ])

        // Map the data for easier consumption in the frontend
        const reporteSueldos = liquidaciones.map(liq => {
            const totalEgresos = liq.descuentosPrestamos
            const montoAdicionales = liq.items.reduce((acc, item) => acc + item.montoCalculado, 0)
            const soloSueldoBase = liq.sueldoProporcional + liq.montoHorasNormales + liq.montoHorasFeriado
            
            return {
                id: liq.id,
                tipo: liq.tipo,
                manualData: liq.desglose,
                empleado: `${liq.empleado.nombre} ${liq.empleado.apellido || ''}`.trim(),
                empleadoDatos: {
                    nombre: liq.empleado.nombre,
                    apellido: liq.empleado.apellido,
                    dni: liq.empleado.dni
                },
                periodo: liq.periodo,
                fechaGeneracion: liq.fechaGeneracion,
                horasExtras: liq.horasExtras + liq.ajusteHorasExtras,
                montoHorasExtras: liq.montoHorasExtras,
                ajusteHorasExtras: liq.ajusteHorasExtras,
                sueldoProporcional: liq.sueldoProporcional,
                montoHorasNormales: liq.montoHorasNormales,
                montoHorasFeriado: liq.montoHorasFeriado,
                montoAdicionales,
                totalBruto: soloSueldoBase + liq.montoHorasExtras + liq.ajusteHorasExtras + montoAdicionales,
                descuentos: totalEgresos,
                totalNeto: liq.totalNeto
            }
        })

        const reporteFinales = liquidacionesFinales.map(liq => {
            return {
                id: liq.id,
                tipo: 'FINAL',
                manualData: { 
                    esLiquidacionFinal: true,
                    tipoEgreso: liq.tipoEgreso,
                    antiguedadAnios: liq.antiguedadAnios,
                    conceptos: liq.detalleConceptos
                },
                empleado: `${liq.empleado.nombre} ${liq.empleado.apellido || ''}`.trim(),
                empleadoDatos: {
                    nombre: liq.empleado.nombre,
                    apellido: liq.empleado.apellido,
                    dni: liq.empleado.dni
                },
                periodo: `Liquidación Final (${liq.tipoEgreso})`,
                fechaGeneracion: liq.fechaEgreso,
                horasExtras: 0,
                montoHorasExtras: 0,
                ajusteHorasExtras: 0,
                sueldoProporcional: 0,
                montoHorasNormales: 0,
                montoHorasFeriado: 0,
                montoAdicionales: 0,
                totalBruto: liq.totalHaberes,
                descuentos: liq.totalDescuentos,
                totalNeto: liq.totalNeto
            }
        })

        const reporte = [...reporteSueldos, ...reporteFinales].sort((a, b) => 
            new Date(b.fechaGeneracion).getTime() - new Date(a.fechaGeneracion).getTime()
        )

        return NextResponse.json(reporte)
    } catch (error) {
        console.error('Error fetching liquidaciones reporte:', error)
        return NextResponse.json({ error: 'Error al obtener reporte de liquidaciones' }, { status: 500 })
    }
}
