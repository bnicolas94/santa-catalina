import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// PUT /api/fichadas/[id] — Actualizar fichada
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { fechaHora, tipo, tipoLicenciaId } = body

        if (!fechaHora || !tipo) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
        }

        const fichada = await prisma.fichadaEmpleado.update({
            where: { id },
            data: {
                fechaHora: new Date(fechaHora),
                tipo,
                tipoLicenciaId
            }
        })

        return NextResponse.json(fichada)
    } catch (error) {
        console.error('Error updating fichada:', error)
        return NextResponse.json({ error: 'Error al actualizar fichada' }, { status: 500 })
    }
}

// DELETE /api/fichadas/[id] — Eliminar fichada
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.fichadaEmpleado.delete({
            where: { id }
        })

        return NextResponse.json({ ok: true, mensaje: 'Fichada eliminada' })
    } catch (error) {
        console.error('Error deleting fichada:', error)
        return NextResponse.json({ error: 'Error al eliminar fichada' }, { status: 500 })
    }
}
