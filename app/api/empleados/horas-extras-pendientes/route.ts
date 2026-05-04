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

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')

        if (!empleadoId) {
            return NextResponse.json({ error: 'Empleado ID requerido' }, { status: 400 })
        }

        await prisma.horaExtraPendiente.deleteMany({
            where: {
                empleadoId,
                pagado: false
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Error clearing pending hours' }, { status: 500 })
    }
}
