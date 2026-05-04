import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const alertas = await prisma.alertaAusentismo.findMany({
            where: { activo: true }
        })
        return NextResponse.json(alertas)
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching alertas' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const alerta = await prisma.alertaAusentismo.create({
            data: body
        })
        return NextResponse.json(alerta)
    } catch (error) {
        return NextResponse.json({ error: 'Error creating alerta' }, { status: 500 })
    }
}
