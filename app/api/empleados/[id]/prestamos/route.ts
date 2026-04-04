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
        const { 
            montoTotal, 
            cantidadCuotas, 
            observaciones, 
            fechaInicio, 
            frecuencia = 'SEMANAL', 
            modoInicio = 'INMEDIATO' 
        } = body

        if (!montoTotal || !cantidadCuotas) {
            return NextResponse.json({ error: 'Monto y cantidad de cuotas son requeridos' }, { status: 400 })
        }

        const montoCuota = parseFloat(montoTotal) / parseInt(cantidadCuotas)

        // 1. Determinar Fecha Base de Inicio
        let fechaBase = fechaInicio ? new Date(fechaInicio) : new Date()

        if (modoInicio === 'AL_FINALIZAR_ANTERIOR') {
            const ultimaCuota = await prisma.cuotaPrestamo.findFirst({
                where: { prestamo: { empleadoId: id }, estado: 'pendiente' },
                orderBy: { fechaVencimiento: 'desc' }
            })
            if (ultimaCuota) {
                fechaBase = new Date(ultimaCuota.fechaVencimiento)
                // Sumamos un salto según la frecuencia para que empiece justo después
                if (frecuencia === 'SEMANAL') fechaBase.setDate(fechaBase.getDate() + 7)
                else fechaBase.setMonth(fechaBase.getMonth() + 1)
            }
        }

        const prestamo = await prisma.$transaction(async (tx) => {
            // 2. Crear Préstamo
            const nuevoPrestamo = await tx.prestamoEmpleado.create({
                data: {
                    empleadoId: id,
                    montoTotal: parseFloat(montoTotal),
                    cantidadCuotas: parseInt(cantidadCuotas),
                    frecuencia: frecuencia,
                    modoInicio: modoInicio,
                    observaciones: observaciones || null,
                }
            })

            // 3. Crear Cuotas
            for (let i = 1; i <= cantidadCuotas; i++) {
                const fechaCuota = new Date(fechaBase)
                
                if (frecuencia === 'SEMANAL') {
                    fechaCuota.setDate(fechaBase.getDate() + (i - 1) * 7)
                } else {
                    fechaCuota.setMonth(fechaBase.getMonth() + (i - 1))
                }

                // Generamos etiqueta mesAnio (compatible con UI anterior)
                const mesAnio = `${(fechaCuota.getMonth() + 1).toString().padStart(2, '0')}-${fechaCuota.getFullYear()}`

                await tx.cuotaPrestamo.create({
                    data: {
                        prestamoId: nuevoPrestamo.id,
                        numeroCuota: i,
                        monto: montoCuota,
                        mesAnio: mesAnio,
                        fechaVencimiento: fechaCuota
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
