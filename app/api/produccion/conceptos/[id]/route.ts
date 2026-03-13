import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/produccion/conceptos/[id] — Actualizar un concepto
export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        const body = await request.json()
        const { nombre, descripcion, activo } = body

        const concepto = await prisma.conceptoProduccion.update({
            where: { id },
            data: {
                nombre,
                descripcion,
                activo: activo !== undefined ? activo : undefined,
            },
        })

        return NextResponse.json(concepto)
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un concepto con este nombre' }, { status: 400 })
        }
        console.error('Error updating concepto:', error)
        return NextResponse.json({ error: 'Error al actualizar concepto' }, { status: 500 })
    }
}

// DELETE /api/produccion/conceptos/[id] — Soft delete de un concepto
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params
        
        // Preferimos soft delete para no romper el historial de asignaciones
        const concepto = await prisma.conceptoProduccion.update({
            where: { id },
            data: { activo: false },
        })

        return NextResponse.json({ message: 'Concepto desactivado', concepto })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 })
        }
        console.error('Error deleting concepto:', error)
        return NextResponse.json({ error: 'Error al desactivar concepto' }, { status: 500 })
    }
}
