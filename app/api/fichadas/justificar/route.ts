import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST /api/fichadas/justificar — Crear jornada manual de 9hs
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fecha } = body // fecha en formato YYYY-MM-DD

        if (!empleadoId || !fecha) {
            return NextResponse.json({ error: 'Empleado y fecha requeridos' }, { status: 400 })
        }

        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            select: { horarioEntrada: true }
        })

        if (!empleado) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

        const [hH, hM] = (empleado.horarioEntrada || '09:00').split(':').map(Number)
        
        // Crear fechas para entrada y salida (9 horas después)
        const dEntrada = new Date(`${fecha}T00:00:00`)
        dEntrada.setHours(hH, hM, 0, 0)

        const dSalida = new Date(dEntrada)
        dSalida.setHours(dEntrada.getHours() + 9)

        // Crear las dos fichadas en una transacción
        await prisma.$transaction([
            prisma.fichadaEmpleado.create({
                data: {
                    empleadoId,
                    tipo: 'entrada',
                    origen: 'justificada',
                    fechaHora: dEntrada
                }
            }),
            prisma.fichadaEmpleado.create({
                data: {
                    empleadoId,
                    tipo: 'salida',
                    origen: 'justificada',
                    fechaHora: dSalida
                }
            })
        ])

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error justificando día:', error)
        return NextResponse.json({ error: 'Error al justificar el día' }, { status: 500 })
    }
}

// DELETE /api/fichadas/justificar — Quitar jornada manual
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const fecha = searchParams.get('fecha') // YYYY-MM-DD

        if (!empleadoId || !fecha) {
            return NextResponse.json({ error: 'Empleado y fecha requeridos' }, { status: 400 })
        }

        const startDate = new Date(`${fecha}T00:00:00`)
        const endDate = new Date(`${fecha}T23:59:59`)

        await prisma.fichadaEmpleado.deleteMany({
            where: {
                empleadoId,
                origen: 'justificada',
                fechaHora: {
                    gte: startDate,
                    lte: endDate
                }
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error quitando justificación:', error)
        return NextResponse.json({ error: 'Error al quitar la justificación' }, { status: 500 })
    }
}
