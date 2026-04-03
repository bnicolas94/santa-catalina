import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/logistica/flota/gastos?vehiculoId=...&mes=...&anio=...
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const vehiculoId = searchParams.get('vehiculoId')
        const mes = searchParams.get('mes')
        const anio = searchParams.get('anio')

        let whereClause: any = {
            vehiculoId: vehiculoId ? vehiculoId : { not: null } // Gastos que tengan un vehículo asignado
        }

        if (mes && anio) {
            const startOfMonth = new Date(parseInt(anio), parseInt(mes) - 1, 1)
            const endOfMonth = new Date(parseInt(anio), parseInt(mes), 0, 23, 59, 59, 999)
            whereClause.fecha = { gte: startOfMonth, lte: endOfMonth }
        }

        const gastos = await prisma.gastoOperativo.findMany({
            where: whereClause,
            orderBy: { fecha: 'desc' },
            include: { 
                categoria: true,
                vehiculo: { select: { patente: true, marca: true, modelo: true } }
            },
        })

        return NextResponse.json(gastos)
    } catch (error) {
        console.error('Error fetching fleet gastos:', error)
        return NextResponse.json({ error: 'Error al obtener gastos de flota' }, { status: 500 })
    }
}

// POST /api/logistica/flota/gastos
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha, monto, descripcion, categoriaId, vehiculoId, kmVehiculo, taller, cajaTipo } = body

        if (!fecha || !monto || !descripcion || !categoriaId || !vehiculoId || !cajaTipo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        // 1. Verificar saldo de caja
        const caja = await prisma.saldoCaja.findUnique({
            where: { tipo: cajaTipo }
        })

        if (!caja) {
            return NextResponse.json({ error: `La caja '${cajaTipo}' no existe` }, { status: 400 })
        }

        if (caja.saldo < parseFloat(monto)) {
            // Permitir saldo negativo o advertir? Generalmente se advierte pero permite si es necesario.
            // Para este caso, vamos a permitirlo pero registrar el movimiento.
        }

        // 2. Ejecutar transacción para asegurar integridad
        const result = await prisma.$transaction(async (tx) => {
            // Crear el Gasto Operativo
            const gasto = await tx.gastoOperativo.create({
                data: {
                    fecha: new Date(fecha),
                    monto: parseFloat(monto),
                    descripcion,
                    categoriaId,
                    vehiculoId,
                    kmVehiculo: kmVehiculo ? parseInt(kmVehiculo) : null,
                    taller: taller || null,
                    recurrente: false,
                    // ubicacionId opcional, buscamos la fábrica por defecto
                }
            })

            // Crear el Movimiento de Caja (Egreso)
            await tx.movimientoCaja.create({
                data: {
                    fecha: new Date(fecha),
                    tipo: 'EGRESO',
                    concepto: `Gasto Flota: ${descripcion}`,
                    monto: -Math.abs(parseFloat(monto)), // Egreso es negativo
                    medioPago: cajaTipo,
                    cajaOrigen: cajaTipo,
                    descripcion: `Vinculado a vehículo ${vehiculoId}`,
                    gastoId: gasto.id
                }
            })

            // Actualizar Saldo de Caja
            await tx.saldoCaja.update({
                where: { tipo: cajaTipo },
                data: {
                    saldo: { decrement: parseFloat(monto) }
                }
            })

            // Actualizar el kilometraje actual del vehículo si se proporcionó uno mayor
            if (kmVehiculo) {
                const vehiculo = await tx.vehiculo.findUnique({ where: { id: vehiculoId } })
                if (vehiculo && parseInt(kmVehiculo) > vehiculo.kmActual) {
                    await tx.vehiculo.update({
                        where: { id: vehiculoId },
                        data: { kmActual: parseInt(kmVehiculo) }
                    })
                }
            }

            return gasto
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error creating fleet gasto:', error)
        return NextResponse.json({ error: 'Error al registrar el gasto de flota' }, { status: 500 })
    }
}
