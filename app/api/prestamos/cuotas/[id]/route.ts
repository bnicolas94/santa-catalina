import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json()
        const { estado, monto } = body

        const updateData: any = {}
        if (estado !== undefined) {
            updateData.estado = estado
            if (estado === 'pendiente') {
                updateData.liquidacionId = null
                updateData.fechaPago = null
            }
        }
        if (monto !== undefined) {
            updateData.monto = parseFloat(monto)
        }

        const cuota = await prisma.cuotaPrestamo.update({
            where: { id },
            data: updateData,
            include: { prestamo: true }
        })

        // Si todas las cuotas están pagadas, marcar el préstamo como pagado
        const allCuotas = await prisma.cuotaPrestamo.findMany({
            where: { prestamoId: cuota.prestamoId }
        })
        
        const allPaid = allCuotas.every(c => c.estado === 'pagada')
        await prisma.prestamoEmpleado.update({
            where: { id: cuota.prestamoId },
            data: { estado: allPaid ? 'pagado' : 'activo' }
        })

        return NextResponse.json(cuota)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        const cuota = await prisma.cuotaPrestamo.findUnique({
            where: { id }
        })

        if (!cuota) {
            return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
        }

        if (cuota.estado === 'pagada') {
            return NextResponse.json({ error: 'No se puede eliminar una cuota ya pagada' }, { status: 400 })
        }

        await prisma.cuotaPrestamo.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
