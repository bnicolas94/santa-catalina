import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/empleados/[id]/prestamos
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const prestamos = await prisma.prestamoEmpleado.findMany({
            where: { empleadoId: id },
            orderBy: { fechaSolicitud: 'desc' },
            include: {
                cuotas: {
                    orderBy: { numeroCuota: 'asc' }
                }
            }
        })
        return NextResponse.json(prestamos)
    } catch (error) {
        console.error('Error fetching prestamos:', error)
        return NextResponse.json({ error: 'Error al obtener prestamos' }, { status: 500 })
    }
}

// POST /api/empleados/[id]/prestamos
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { montoTotal, cantidadCuotas, observaciones, fechaInicio } = body

        if (!montoTotal || !cantidadCuotas) {
            return NextResponse.json({ error: 'Monto y cantidad de cuotas son requeridos' }, { status: 400 })
        }

        const montoCuota = montoTotal / cantidadCuotas

        // Calcular meses para las cuotas basado en fechaInicio (o actual si no viene)
        const fechaBase = fechaInicio ? new Date(fechaInicio) : new Date()

        const prestamo = await prisma.$transaction(async (tx) => {
            // 1. Crear Préstamo
            const nuevoPrestamo = await tx.prestamoEmpleado.create({
                data: {
                    empleadoId: id,
                    montoTotal: parseFloat(montoTotal),
                    cantidadCuotas: parseInt(cantidadCuotas),
                    observaciones: observaciones || null,
                }
            })

            // 2. Crear Cuotas
            for (let i = 1; i <= cantidadCuotas; i++) {
                // Avanzamos los meses según el número de cuota
                const fechaCuota = new Date(fechaBase)
                fechaCuota.setMonth(fechaBase.getMonth() + (i - 1))
                const mesAnio = `${(fechaCuota.getMonth() + 1).toString().padStart(2, '0')}-${fechaCuota.getFullYear()}`

                await tx.cuotaPrestamo.create({
                    data: {
                        prestamoId: nuevoPrestamo.id,
                        numeroCuota: i,
                        monto: montoCuota,
                        mesAnio: mesAnio
                    }
                })
            }

            return nuevoPrestamo
        })

        return NextResponse.json(prestamo, { status: 201 })
    } catch (error) {
        console.error('Error creating prestamo:', error)
        return NextResponse.json({ error: 'Error al crear prestamo' }, { status: 500 })
    }
}
