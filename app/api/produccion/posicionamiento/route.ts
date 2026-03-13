import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/produccion/posicionamiento — Obtener asignaciones por fecha y ubicación
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha')
        const ubicacionId = searchParams.get('ubicacionId')

        if (!fechaStr || !ubicacionId) {
            return NextResponse.json(
                { error: 'Fecha y ubicación son requeridas' },
                { status: 400 }
            )
        }

        const fecha = new Date(fechaStr)
        // Normalizar fecha a inicio del día para la búsqueda
        const startOfDay = new Date(fecha.setHours(0, 0, 0, 0))
        const endOfDay = new Date(fecha.setHours(23, 59, 59, 999))

        const asignaciones = await prisma.asignacionOperario.findMany({
            where: {
                fecha: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                ubicacionId: ubicacionId,
            },
            include: {
                empleado: {
                    select: { id: true, nombre: true, apellido: true }
                },
                concepto: {
                    select: { id: true, nombre: true }
                }
            }
        })

        return NextResponse.json(asignaciones)
    } catch (error) {
        console.error('Error fetching asignaciones:', error)
        return NextResponse.json({ error: 'Error al obtener asignaciones' }, { status: 500 })
    }
}

// POST /api/produccion/posicionamiento — Guardar/Actualizar asignaciones para un día
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { fecha: fechaStr, ubicacionId, asignaciones } = body

        if (!fechaStr || !ubicacionId || !Array.isArray(asignaciones)) {
            return NextResponse.json(
                { error: 'Datos incompletos' },
                { status: 400 }
            )
        }

        const fecha = new Date(fechaStr)
        const startOfDay = new Date(fecha.setHours(0, 0, 0, 0))
        const endOfDay = new Date(fecha.setHours(23, 59, 59, 999))

        // Usamos una transacción para asegurar consistencia
        const result = await prisma.$transaction(async (tx) => {
            // 1. Eliminar asignaciones previas para ese día y ubicación
            await tx.asignacionOperario.deleteMany({
                where: {
                    fecha: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                    ubicacionId: ubicacionId,
                }
            })

            // 2. Crear las nuevas asignaciones
            const nuevasAsignaciones = await Promise.all(
                asignaciones.map((a: any) => 
                    tx.asignacionOperario.create({
                        data: {
                            fecha: startOfDay, // Guardamos siempre el inicio del día
                            empleadoId: a.empleadoId,
                            conceptoId: a.conceptoId,
                            ubicacionId: ubicacionId,
                            observaciones: a.observaciones,
                        }
                    })
                )
            )

            return nuevasAsignaciones
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Error saving asignaciones:', error)
        return NextResponse.json({ error: 'Error al guardar asignaciones' }, { status: 500 })
    }
}
