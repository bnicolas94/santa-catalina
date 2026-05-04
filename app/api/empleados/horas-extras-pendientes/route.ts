import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, cantidadHoras, montoCalculado, observaciones } = body

        if (!empleadoId || !cantidadHoras) {
            return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
        }

        const hp = await prisma.horaExtraPendiente.create({
            data: {
                empleadoId,
                cantidadHoras: parseFloat(cantidadHoras),
                montoCalculado: parseFloat(montoCalculado || 0),
                observaciones
            }
        })

        return NextResponse.json(hp)
    } catch (error) {
        return NextResponse.json({ error: 'Error creating pending hours' }, { status: 500 })
    }
}
