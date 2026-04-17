import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PlanificacionService } from '@/lib/services/planificacion.service'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para ver planificación' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha') // YYYY-MM-DD

        if (!fechaStr) {
            return NextResponse.json({ error: 'Fecha es requerida' }, { status: 400 })
        }

        const data = await PlanificacionService.getPlanificacionDiaria(fechaStr)
        return NextResponse.json(data)

    } catch (error) {
        console.error('Error en planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const userRol = (session?.user as any)?.rol
        const permisos = (session?.user as any)?.permisos || {}

        if (userRol !== 'ADMIN' && !permisos.permisoProduccion) {
            return NextResponse.json({ error: 'No tienes permiso para borrar planificación' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const fechaStr = searchParams.get('fecha')

        if (!fechaStr) {
            return NextResponse.json({ error: 'Fecha es requerida' }, { status: 400 })
        }

        const startOfDay = new Date(`${fechaStr}T00:00:00.000Z`)
        const endOfDay = new Date(`${fechaStr}T23:59:59.999Z`)

        // PREVENCIÓN: No permitir borrar los turnos que ya fueron procesados y descontados
        // @ts-ignore
        const yaDescontados = await prisma.planificacionDescuento.findMany({
            where: { fecha: startOfDay },
            select: { turno: true }
        })

        const turnosDescontados = yaDescontados.map((d: any) => d.turno)

        let message = 'Planificación eliminada'
        if (turnosDescontados.length > 0) {
            message = `Planificación eliminada parcial (se conservaron los turnos ya descontados: ${turnosDescontados.join(', ')})`
            
            await prisma.requerimientoProduccion.deleteMany({
                where: { 
                    fecha: { gte: startOfDay, lte: endOfDay },
                    turno: { notIn: turnosDescontados }
                }
            })
        } else {
            await prisma.requerimientoProduccion.deleteMany({
                where: { fecha: { gte: startOfDay, lte: endOfDay } }
            })
        }

        return NextResponse.json({ success: true, message })

    } catch (error) {
        console.error('Error al borrar planificación:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
