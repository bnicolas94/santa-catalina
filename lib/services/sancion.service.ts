import { prisma } from '@/lib/prisma'
import { eventBus } from '@/lib/events'

export interface CreateSancionInput {
    empleadoId: string
    fecha?: string
    tipo: string
    motivo: string
    observaciones?: string
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
                alertaId: null
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
