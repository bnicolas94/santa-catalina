import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, subDays } from 'date-fns'

export async function GET() {
    try {
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            select: { id: true, nombre: true, apellido: true }
        })

        const alertas = await prisma.alertaAusentismo.findMany({
            where: { activo: true }
        })

        const resumen = await Promise.all(empleados.map(async (emp) => {
            const stats: any = {
                id: emp.id,
                nombre: `${emp.nombre} ${emp.apellido || ''}`.trim(),
                inasistenciasTotales: 0,
                alertasDisparadas: []
            }

            // Contar inasistencias por tipo
            const counts = await prisma.inasistencia.groupBy({
                by: ['tipo'],
                where: { empleadoId: emp.id },
                _count: { id: true }
            })

            counts.forEach(c => {
                stats[`count_${c.tipo}`] = c._count.id
                stats.inasistenciasTotales += c._count.id
            })

            // Verificar alertas
            for (const alerta of alertas) {
                const fechaLimite = subDays(new Date(), alerta.periodoDias)
                
                const recentEvents = await prisma.inasistencia.findMany({
                    where: {
                        empleadoId: emp.id,
                        tipo: alerta.tipoInasistencia,
                        fecha: { gte: fechaLimite }
                    },
                    orderBy: { fecha: 'desc' },
                    take: 5,
                    select: { fecha: true, minutosRetraso: true, observaciones: true }
                })

                const countRecent = recentEvents.length

                if (countRecent >= alerta.limiteMaximo) {
                    stats.alertasDisparadas.push({
                        alertaId: alerta.id,
                        tipo: alerta.tipoInasistencia,
                        actual: countRecent,
                        limite: alerta.limiteMaximo,
                        accion: alerta.accionSugerida,
                        periodoDias: alerta.periodoDias,
                        detalles: recentEvents.map(e => ({
                            fecha: e.fecha,
                            minutos: e.minutosRetraso,
                            obs: e.observaciones
                        }))
                    })
                }
            }

            return stats
        }))

        return NextResponse.json(resumen)
    } catch (error) {
        console.error('Error in resumen inasistencias:', error)
        return NextResponse.json({ error: 'Error al generar resumen' }, { status: 500 })
    }
}
