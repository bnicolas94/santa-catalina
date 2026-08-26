import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function fechaArgentina(value: string, finDelDia = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    return new Date(`${value}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}-03:00`)
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string } | undefined
        if (!usuario?.id) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

        const params = new URL(request.url).searchParams
        const empleadoId = params.get('empleadoId')?.trim() || ''
        const origen = params.get('origen')?.trim().toUpperCase() || ''
        const buscar = params.get('buscar')?.trim() || ''
        const desde = fechaArgentina(params.get('desde') || '')
        const hasta = fechaArgentina(params.get('hasta') || '', true)

        const where: Prisma.HistorialSalarialWhereInput = {
            ...(empleadoId ? { empleadoId } : {}),
            ...(origen === 'EMPLEADO' || origen === 'ROL' ? { origen } : {}),
            ...(desde || hasta ? {
                fechaVigencia: {
                    ...(desde ? { gte: desde } : {}),
                    ...(hasta ? { lte: hasta } : {}),
                },
            } : {}),
            ...(buscar ? {
                empleado: {
                    is: {
                        OR: [
                            { nombre: { contains: buscar, mode: 'insensitive' } },
                            { apellido: { contains: buscar, mode: 'insensitive' } },
                            { dni: { contains: buscar, mode: 'insensitive' } },
                        ],
                    },
                },
            } : {}),
        }

        const historial = await prisma.historialSalarial.findMany({
            where,
            orderBy: [{ fechaVigencia: 'desc' }, { createdAt: 'desc' }],
            take: 500,
            include: {
                empleado: { select: { id: true, nombre: true, apellido: true, dni: true } },
                rol: { select: { id: true, nombre: true } },
                registradoPor: { select: { id: true, nombre: true, apellido: true } },
            },
        })

        return NextResponse.json({ historial })
    } catch (error) {
        console.error('Error obteniendo historial salarial:', error)
        return NextResponse.json({ error: 'No se pudo obtener el historial salarial.' }, { status: 500 })
    }
}
