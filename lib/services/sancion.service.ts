import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'
import { subDays } from 'date-fns'

export interface CreateSancionInput {
    empleadoId: string
    fecha?: string
    tipo: string
    motivo: string
    observaciones?: string
    alertaId?: string
}

export class SancionService {

    /**
     * Crea una sanción o apercibimiento de forma manual.
     */
    static async create(input: CreateSancionInput) {
        const sancion = await prisma.sancion.create({
            data: {
                empleadoId: input.empleadoId,
                fecha: input.fecha ? new Date(input.fecha) : new Date(),
                tipo: input.tipo,
                motivo: input.motivo,
                observaciones: input.observaciones || null,
                alertaId: input.alertaId || null
            }
        })

        eventBus.emit('sancion:created', { 
            sancionId: sancion.id, 
            empleadoId: sancion.empleadoId,
            tipo: sancion.tipo 
        })

        return sancion
    }

    /**
     * Verifica las alertas de ausentismo para un empleado y aplica sanciones automáticas
     * si la alerta está configurada con 'autoSancionar'.
     */
    static async checkAndApplyAlerts(empleadoId: string) {
        const alertas = await prisma.alertaAusentismo.findMany({
            where: { activo: true, autoSancionar: true }
        })

        const logs: string[] = []

        for (const alerta of alertas) {
            const fechaLimite = subDays(new Date(), alerta.periodoDias)
            
            // Contar inasistencias/tardanzas del tipo específico en el periodo
            const countRecent = await prisma.inasistencia.count({
                where: {
                    empleadoId,
                    tipo: alerta.tipoInasistencia,
                    fecha: { gte: fechaLimite }
                }
            })

            if (countRecent >= alerta.limiteMaximo) {
                // Verificar si ya se aplicó una sanción automática por esta alerta recientemente
                // para evitar duplicados en el mismo periodo si no ha cambiado el contador significativamente
                // REGLA: Solo sancionamos si el contador es EXACTAMENTE el límite o múltiplo? 
                // Mejor: Verificamos si ya existe una sanción vinculada a esta alerta y este empleado
                // que cubra el mismo "incidente" (mismo conteo).
                
                const yaSancionado = await prisma.sancion.findFirst({
                    where: {
                        empleadoId,
                        alertaId: alerta.id,
                        motivo: { contains: `conteo: ${countRecent}` }
                    }
                })

                if (!yaSancionado) {
                    const tipoSancion = alerta.tipoSancionAuto || 'APERCIBIMIENTO'
                    const motivo = `Automático por alerta: ${alerta.tipoInasistencia} (Límite: ${alerta.limiteMaximo}, Actual: ${countRecent})`
                    
                    await this.create({
                        empleadoId,
                        tipo: tipoSancion,
                        motivo,
                        observaciones: `Sanción generada automáticamente por sistema de alertas. ID Alerta: ${alerta.id}, conteo: ${countRecent}`,
                        alertaId: alerta.id
                    })
                    
                    logs.push(`Sanción ${tipoSancion} aplicada a empleado ${empleadoId} por ${alerta.tipoInasistencia}`)
                }
            }
        }

        return logs
    }

    /**
     * Lista sanciones con filtros.
     */
    static async findAll(filters?: { empleadoId?: string, tipo?: string }) {
        return prisma.sancion.findMany({
            where: {
                ...(filters?.empleadoId ? { empleadoId: filters.empleadoId } : {}),
                ...(filters?.tipo ? { tipo: filters.tipo } : {})
            },
            include: {
                empleado: {
                    select: { nombre: true, apellido: true, rol: true, dni: true }
                }
            },
            orderBy: { fecha: 'desc' }
        })
    }
}
