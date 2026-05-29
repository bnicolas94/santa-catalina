import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SancionService } from '@/lib/services/sancion.service'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fecha, status } = body

        if (!empleadoId || !fecha || !status) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (empleadoId, fecha, status)' }, { status: 400 })
        }

        // Normalizar fecha en UTC para evitar desfases de zona horaria
        const startOfDay = new Date(`${fecha}T00:00:00.000Z`)
        const endOfDay = new Date(`${fecha}T23:59:59.999Z`)

        // 1. Eliminar inasistencia previa en este rango de fecha
        await prisma.inasistencia.deleteMany({
            where: {
                empleadoId,
                fecha: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        })

        // 2. Si el estado es una inasistencia, registrarla
        if (status === 'ENFERMEDAD') {
            await prisma.inasistencia.create({
                data: {
                    empleadoId,
                    fecha: startOfDay,
                    tipo: 'JUSTIFICADA',
                    motivo: 'Enfermedad',
                    tieneCertificado: true,
                    observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                }
            })
        } else if (status === 'SIN_AVISO') {
            await prisma.inasistencia.create({
                data: {
                    empleadoId,
                    fecha: startOfDay,
                    tipo: 'INJUSTIFICADA',
                    motivo: 'Ausencia sin aviso',
                    tieneCertificado: false,
                    observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                }
            })
        } else if (status === 'CON_AVISO') {
            await prisma.inasistencia.create({
                data: {
                    empleadoId,
                    fecha: startOfDay,
                    tipo: 'JUSTIFICADA',
                    motivo: 'Ausencia con aviso',
                    tieneCertificado: false,
                    observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                }
            })
        }

        // 3. Recalcular alertas/sanciones automáticas
        try {
            await SancionService.checkAndApplyAlerts(empleadoId)
        } catch (alertaError) {
            console.error('Error al procesar alertas tras modificar asistencia diaria:', alertaError)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error en POST /api/empleados/asistencia-diaria:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
