import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const ubicaciones = await prisma.ubicacion.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        })
        return NextResponse.json(ubicaciones)
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener ubicaciones' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const { nombre, tipo } = await req.json()
        const ubicacion = await prisma.ubicacion.create({
            data: { nombre, tipo }
        })
        return NextResponse.json(ubicacion)
    } catch (error) {
        return NextResponse.json({ error: 'Error al crear ubicacion' }, { status: 500 })
    }
}
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

        await prisma.ubicacion.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json({ error: 'Error al eliminar ubicacion' }, { status: 500 })
    }
}
