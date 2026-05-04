import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const alerta = await prisma.alertaAusentismo.update({
            where: { id },
            data: body
        })
        return NextResponse.json(alerta)
    } catch (error) {
        return NextResponse.json({ error: 'Error updating alerta' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        await prisma.alertaAusentismo.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Error deleting alerta' }, { status: 500 })
    }
}
