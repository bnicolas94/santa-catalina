import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SancionService } from '@/lib/services/sancion.service'
import { instanteRRHH, rangoDiaRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fecha, fechas, status } = body

        if (!empleadoId || (!fecha && !fechas) || !status) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (empleadoId, fecha/fechas, status)' }, { status: 400 })
        }

        const targetDates = fechas && Array.isArray(fechas) ? fechas : [fecha]

        for (const targetDate of targetDates) {
            const fechaCivil = validarFechaCivilRRHH(String(targetDate))
            const rangoDia = rangoDiaRRHH(fechaCivil)
            const fechaRegistro = instanteRRHH(fechaCivil, '12:00:00')

            // 1. Eliminar inasistencia previa en este rango de fecha
            await prisma.inasistencia.deleteMany({
                where: {
                    empleadoId,
                    fecha: {
                        gte: rangoDia.gte,
                        lt: rangoDia.lt,
                    }
                }
            })

            // 2. Si el estado es una inasistencia o override manual, registrarla
            if (status === 'ENFERMEDAD') {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId,
                        fecha: fechaRegistro,
                        tipo: 'JUSTIFICADA_PAGA',
                        motivo: 'Enfermedad',
                        tieneCertificado: true,
                        observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                    }
                })
            } else if (status === 'SIN_AVISO') {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId,
                        fecha: fechaRegistro,
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
                        fecha: fechaRegistro,
                        tipo: 'JUSTIFICADA',
                        motivo: 'Ausencia con aviso',
                        tieneCertificado: false,
                        observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                    }
                })
            } else if (status === 'FRANCO') {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId,
                        fecha: fechaRegistro,
                        tipo: 'FRANCO',
                        motivo: 'Franco',
                        tieneCertificado: false,
                        observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                    }
                })
            } else if (status === 'FERIADO') {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId,
                        fecha: fechaRegistro,
                        tipo: 'FERIADO',
                        motivo: 'Feriado',
                        tieneCertificado: false,
                        observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                    }
                })
            } else if (status === 'TRABAJO') {
                await prisma.inasistencia.create({
                    data: {
                        empleadoId,
                        fecha: fechaRegistro,
                        tipo: 'TRABAJO',
                        motivo: 'Trabajó',
                        tieneCertificado: false,
                        observaciones: 'Modificado desde Planilla de Asistencia Diaria'
                    }
                })
            }
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
