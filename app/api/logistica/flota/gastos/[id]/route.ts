import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const result = await prisma.$transaction(async (tx) => {
            // 1. Buscar el gasto
            const gasto = await tx.gastoOperativo.findUnique({
                where: { id },
                include: { movimientosCaja: true }
            })

            if (!gasto) {
                throw new Error('Gasto no encontrado')
            }

            // 2. Si tiene movimientos de caja vinculados, revertirlos y eliminarlos
            if (gasto.movimientosCaja && gasto.movimientosCaja.length > 0) {
                for (const mov of gasto.movimientosCaja) {
                    await CajaService.revertirMovimientoEnTx(tx, mov.id)
                }
            }

            // 3. Eliminar el gasto operativo
            await tx.gastoOperativo.delete({
                where: { id }
            })

            return { success: true }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error deleting fleet gasto:', error)
        return NextResponse.json({ error: error.message || 'Error al eliminar el gasto' }, { status: 500 })
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { fecha, monto, descripcion, categoriaId, vehiculoId, kmVehiculo, taller, cajaTipo } = body

        const result = await prisma.$transaction(async (tx) => {
            // 1. Buscar el gasto original
            const oldGasto = await tx.gastoOperativo.findUnique({
                where: { id },
                include: { movimientosCaja: true }
            })

            if (!oldGasto) throw new Error('Gasto no encontrado')

            const numericMonto = Math.abs(parseFloat(monto))

            // 2. Actualizar el Gasto Operativo
            const gasto = await tx.gastoOperativo.update({
                where: { id },
                data: {
                    fecha: new Date(fecha),
                    monto: numericMonto,
                    descripcion: descripcion || '',
                    categoriaId,
                    vehiculoId,
                    kmVehiculo: kmVehiculo ? parseInt(kmVehiculo) : null,
                    taller: taller || null,
                }
            })

            // 3. Si tiene movimientos de caja, actualizarlos (asumiendo 1 por ahora para gastos de flota)
            if (oldGasto.movimientosCaja && oldGasto.movimientosCaja.length > 0) {
                for (const mov of oldGasto.movimientosCaja) {
                    await CajaService.updateMovimiento(mov.id, {
                        monto: numericMonto,
                        concepto: `Gasto Flota (Editado): ${descripcion || 'S/D'}`,
                        fecha: gasto.fecha,
                        cajaOrigen: cajaTipo,
                    })
                }
            }

            return gasto
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error updating fleet gasto:', error)
        return NextResponse.json({ error: error.message || 'Error al actualizar el gasto' }, { status: 500 })
    }
}
