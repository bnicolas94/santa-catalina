import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const licencias = await prisma.tipoLicencia.findMany({
            orderBy: { nombre: 'asc' }
        })
        return NextResponse.json(licencias)
    } catch (error) {
        console.error('Error fetching licencias:', error)
        return NextResponse.json({ error: 'Error al obtener tipos de licencia' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { nombre, descripcion, conGoceSueldo, activo } = body

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
        }

        const nuevaLicencia = await prisma.tipoLicencia.create({
            data: {
                nombre,
                descripcion,
                conGoceSueldo,
                activo: activo !== undefined ? activo : true
            }
        })
        return NextResponse.json(nuevaLicencia, { status: 201 })
    } catch (error: any) {
        console.error('Error creating licencia:', error)
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe una licencia con ese nombre' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Error al crear la licencia' }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })

        const body = await req.json()
        const { nombre, descripcion, conGoceSueldo, activo } = body

        if (!nombre) {
            return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
        }

        const actualizada = await prisma.tipoLicencia.update({
            where: { id },
            data: {
                nombre,
                descripcion,
                conGoceSueldo,
                activo
            }
        })
        return NextResponse.json(actualizada)
    } catch (error: any) {
        console.error('Error updating licencia:', error)
        if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe una licencia con ese nombre' }, { status: 400 })
        return NextResponse.json({ error: 'Error al actualizar la licencia' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 })

        await prisma.tipoLicencia.delete({
            where: { id }
        })
        return NextResponse.json({ message: 'Licencia eliminada exitosamente' })
    } catch (error) {
        console.error('Error deleting licencia:', error)
        return NextResponse.json({ error: 'Error al eliminar la licencia, podría estar en uso por alguna fichada.' }, { status: 500 })
    }
}
