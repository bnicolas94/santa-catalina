import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')
        const desde = searchParams.get('desde')
        const hasta = searchParams.get('hasta')

        const where: any = {}
        if (empleadoId) where.empleadoId = empleadoId
        if (desde || hasta) {
            where.fecha = {}
            if (desde) where.fecha.gte = new Date(desde)
            if (hasta) where.fecha.lte = new Date(hasta)
        }

        const inasistencias = await prisma.inasistencia.findMany({
            where,
            include: {
                empleado: {
                    select: {
                        nombre: true,
                        apellido: true,
                        rol: true
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        })

        return NextResponse.json(inasistencias)
    } catch (error) {
        console.error('Error fetching inasistencias:', error)
        return NextResponse.json({ error: 'Error al obtener inasistencias' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, fecha, tipo, motivo, tieneCertificado, observaciones } = body

        if (!empleadoId || !fecha || !tipo) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        const inasistencia = await prisma.inasistencia.create({
            data: {
                empleadoId,
                fecha: new Date(fecha),
                tipo,
                motivo,
                tieneCertificado: !!tieneCertificado,
                observaciones
            }
        })

        return NextResponse.json(inasistencia)
    } catch (error) {
        console.error('Error creating inasistencia:', error)
        return NextResponse.json({ error: 'Error al registrar inasistencia' }, { status: 500 })
    }
}
