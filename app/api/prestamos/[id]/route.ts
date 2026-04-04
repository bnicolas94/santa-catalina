import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// DELETE /api/prestamos/[id]
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. Verificar si el préstamo tiene cuotas pagadas
        const cuotasPagadas = await prisma.cuotaPrestamo.count({
            where: { 
                prestamoId: id,
                estado: 'pagada'
            }
        })

        if (cuotasPagadas > 0) {
            return NextResponse.json(
                { error: 'No se puede eliminar un préstamo que ya tiene cuotas pagadas.' },
                { status: 400 }
            )
        }

        // 2. Eliminar el préstamo (las cuotas se eliminan por Cascade en BD)
        await prisma.prestamoEmpleado.delete({
            where: { id }
        })

        return NextResponse.json({ message: 'Préstamo eliminado correctamente' })
    } catch (error) {
        console.error('Error deleting prestamo:', error)
        return NextResponse.json({ error: 'Error al eliminar el préstamo' }, { status: 500 })
    }
}
