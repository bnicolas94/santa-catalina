import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/logistica/flota/asignaciones?fecha=YYYY-MM-DD&turno=Mañana
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const fecha = searchParams.get('fecha')
        const turno = searchParams.get('turno')

        if (!fecha) {
            return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 })
        }

        const date = new Date(fecha)
        date.setHours(0, 0, 0, 0)
        const nextDay = new Date(date)
        nextDay.setDate(date.getDate() + 1)

        const asignaciones = await prisma.asignacionVehiculo.findMany({
            where: {
                fecha: {
                    gte: date,
                    lt: nextDay
                },
                ...(turno ? { turno } : {})
            },
            include: {
                empleado: { select: { id: true, nombre: true, apellido: true } },
                vehiculo: { select: { id: true, patente: true, marca: true, modelo: true } }
            }
        })

        return NextResponse.json(asignaciones)
    } catch (error) {
        console.error('Error fetching assignments:', error)
        return NextResponse.json({ error: 'Error al obtener asignaciones' }, { status: 500 })
    }
}

// POST /api/logistica/flota/asignaciones
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const { fecha, turno, empleadoId, vehiculoId, kmInicio, novedades } = body

        if (!fecha || !turno || !empleadoId || !vehiculoId) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        const date = new Date(fecha)
        date.setHours(0, 0, 0, 0)

        // Check if driver already has a vehicle for this shift
        const existingDriver = await prisma.asignacionVehiculo.findFirst({
            where: { fecha: date, turno, empleadoId }
        })

        // Check if vehicle already has a driver for this shift
        const existingVehicle = await prisma.asignacionVehiculo.findFirst({
            where: { fecha: date, turno, vehiculoId }
        })

        if (existingDriver || existingVehicle) {
            // If it's an update of the same assignment, we should allow it. 
            // But here we are using upsert logic or just checking.
            // Let's use upsert based on the unique constraints.
        }

        const asignacion = await prisma.asignacionVehiculo.upsert({
            where: {
                fecha_turno_empleadoId: {
                    fecha: date,
                    turno,
                    empleadoId
                }
            },
            update: {
                vehiculoId,
                kmInicio: kmInicio || null,
                novedades: novedades || null
            },
            create: {
                fecha: date,
                turno,
                empleadoId,
                vehiculoId,
                kmInicio: kmInicio || null,
                novedades: novedades || null
            }
        })

        return NextResponse.json(asignacion)
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'El vehículo ya está asignado a otro chofer en este turno' }, { status: 400 })
        }
        console.error('Error creating assignment:', error)
        return NextResponse.json({ error: 'Error al crear la asignación' }, { status: 500 })
    }
}

// DELETE /api/logistica/flota/asignaciones?id=...
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'Falta ID' }, { status: 400 })

        await prisma.asignacionVehiculo.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting assignment:', error)
        return NextResponse.json({ error: 'Error al eliminar asignación' }, { status: 500 })
    }
}
