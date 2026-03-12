import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { origen, destino, monto, fecha } = await req.json()
        const numericMonto = parseFloat(monto)

        if (!origen || !destino || !numericMonto || numericMonto <= 0) {
            return NextResponse.json({ error: 'Datos de transferencia inválidos' }, { status: 400 })
        }

        if (origen === destino) {
            return NextResponse.json({ error: 'La caja de origen y destino deben ser diferentes' }, { status: 400 })
        }

        const customDate = fecha ? new Date(fecha) : new Date()

        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear el egreso de la caja origen
            const egreso = await tx.movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: 'transferencia_interna',
                    monto: numericMonto,
                    medioPago: 'efectivo',
                    cajaOrigen: origen,
                    descripcion: `Transferencia hacia ${destino}`,
                    fecha: customDate,
                }
            })

            // 2. Crear el ingreso a la caja destino
            const ingreso = await tx.movimientoCaja.create({
                data: {
                    tipo: 'ingreso',
                    concepto: 'transferencia_interna',
                    monto: numericMonto,
                    medioPago: 'efectivo',
                    cajaOrigen: destino,
                    descripcion: `Transferencia desde ${origen}`,
                    fecha: customDate,
                }
            })

            // 3. Actualizar saldo caja origen (decremento)
            await tx.saldoCaja.update({
                where: { tipo: origen },
                data: { saldo: { decrement: numericMonto } }
            })

            // 4. Actualizar saldo caja destino (incremento)
            await tx.saldoCaja.update({
                where: { tipo: destino },
                data: { saldo: { increment: numericMonto } }
            })

            return { egreso, ingreso }
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error en transferencia:', error)
        return NextResponse.json({ error: 'Error al procesar la transferencia' }, { status: 500 })
    }
}
