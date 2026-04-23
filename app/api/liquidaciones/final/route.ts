import { NextResponse } from 'next/server'
import { LiquidacionFinalService } from '@/lib/services/liquidacion-final.service'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { isPreview, empleadoId, fechaEgreso, causaEgreso, omitirPreaviso, customCalculo } = body

        if (!empleadoId || !fechaEgreso || !causaEgreso) {
            return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
        }

        const calculo = customCalculo || await LiquidacionFinalService.calcular({
            empleadoId,
            fechaEgreso,
            causaEgreso,
            omitirPreaviso
        })

        if (isPreview) {
            return NextResponse.json(calculo)
        }

        // Guardar liquidación final
        const liquidacion = await prisma.$transaction(async (tx) => {
            // Asegurarse de que exista el concepto genérico
            let concepto = await tx.conceptoSalarial.findFirst({
                where: { nombre: 'Liquidación Final' }
            })

            if (!concepto) {
                concepto = await tx.conceptoSalarial.create({
                    data: {
                        nombre: 'Liquidación Final',
                        tipo: 'REMUNERATIVO',
                        activo: true
                    }
                })
            }

            const liq = await tx.liquidacionSueldo.create({
                data: {
                    empleadoId,
                    periodo: `FINAL-${fechaEgreso}`,
                    tipo: 'FINAL',
                    sueldoProporcional: calculo.totalNeto,
                    totalNeto: calculo.totalNeto,
                    estado: 'completo',
                    desglose: calculo as any,
                    items: {
                        create: calculo.items.map(item => ({
                            conceptoSalarialId: concepto!.id,
                            montoCalculado: item.monto,
                            detalle: item.nombre
                        }))
                    }
                }
            })

            // Dar de baja al empleado
            await tx.empleado.update({
                where: { id: empleadoId },
                data: { activo: false }
            })

            return liq
        })

        return NextResponse.json(liquidacion)
    } catch (error: any) {
        console.error('Error en liquidación final:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
