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

        // Recalcular montoTotal y cantidadCuotas del préstamo
        const allCuotas = await prisma.cuotaPrestamo.findMany({
            where: { prestamoId: cuota.prestamoId }
        })
        
        const newTotal = allCuotas.reduce((acc, c) => acc + c.monto, 0)
        const newCount = allCuotas.length
        const allPaid = allCuotas.length > 0 && allCuotas.every(c => c.estado === 'pagada')

        await prisma.prestamoEmpleado.update({
            where: { id: cuota.prestamoId },
            data: { 
                montoTotal: newTotal,
                cantidadCuotas: newCount,
                estado: allPaid ? 'pagado' : 'activo' 
            }
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
            where: { id },
            include: { prestamo: true }
        })

        if (!cuota) {
            return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
        }

        if (cuota.estado === 'pagada') {
            return NextResponse.json({ error: 'No se puede eliminar una cuota ya pagada' }, { status: 400 })
        }

        const prestamoId = cuota.prestamoId

        await prisma.cuotaPrestamo.delete({
            where: { id }
        })

        // Recalcular tras eliminar
        const remainingCuotas = await prisma.cuotaPrestamo.findMany({
            where: { prestamoId }
        })

        const newTotal = remainingCuotas.reduce((acc, c) => acc + c.monto, 0)
        const newCount = remainingCuotas.length
        const allPaid = remainingCuotas.length > 0 && remainingCuotas.every(c => c.estado === 'pagada')

        await prisma.prestamoEmpleado.update({
            where: { id: prestamoId },
            data: { 
                montoTotal: newTotal,
                cantidadCuotas: newCount,
                estado: allPaid ? 'pagado' : 'activo' 
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
