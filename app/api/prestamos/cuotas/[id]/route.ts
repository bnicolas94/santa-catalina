import { NextResponse } from 'next/server'

import { estadoPrestamoDesdeCuotas, validarMontoPrestamo } from '@/lib/payroll/prestamos'
import { prisma } from '@/lib/prisma'

class CuotaApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params
        const body = await req.json()
        if ('estado' in body) {
            throw new CuotaApiError('El estado de una cuota no se modifica manualmente. Revertí la liquidación de origen si necesitás reabrirla.', 409)
        }
        const monto = validarMontoPrestamo(body.monto)

        const cuotaActualizada = await prisma.$transaction(async tx => {
            const cuotaLockKey = `cuota-prestamo:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${cuotaLockKey}))::text AS lock_result`

            const cuota = await tx.cuotaPrestamo.findUnique({ where: { id } })
            if (!cuota) throw new CuotaApiError('Cuota no encontrada.', 404)

            const prestamoLockKey = `prestamo:${cuota.prestamoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${prestamoLockKey}))::text AS lock_result`

            const prestamo = await tx.prestamoEmpleado.findUnique({
                where: { id: cuota.prestamoId },
                select: { empleadoId: true },
            })
            if (!prestamo) throw new CuotaApiError('Préstamo no encontrado.', 404)

            const liquidacionLockKey = `liquidacion:${prestamo.empleadoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${liquidacionLockKey}))::text AS lock_result`

            const cuotaVigente = await tx.cuotaPrestamo.findUnique({ where: { id } })
            if (!cuotaVigente) throw new CuotaApiError('Cuota no encontrada.', 404)
            if (cuotaVigente.estado !== 'pendiente' || cuotaVigente.liquidacionId) {
                throw new CuotaApiError('Sólo puede editarse una cuota pendiente y sin liquidación asociada.', 409)
            }

            const actualizada = await tx.cuotaPrestamo.update({
                where: { id },
                data: { monto },
            })
            const cuotas = await tx.cuotaPrestamo.findMany({ where: { prestamoId: cuotaVigente.prestamoId } })
            await tx.prestamoEmpleado.update({
                where: { id: cuotaVigente.prestamoId },
                data: {
                    montoTotal: Math.round(cuotas.reduce((total, item) => total + item.monto, 0) * 100) / 100,
                    cantidadCuotas: cuotas.length,
                    estado: estadoPrestamoDesdeCuotas(cuotas),
                },
            })
            return actualizada
        })

        return NextResponse.json(cuotaActualizada)
    } catch (error) {
        console.error('Error updating cuota:', error)
        const status = error instanceof CuotaApiError ? error.status : error instanceof Error && error.message.includes('monto') ? 400 : 500
        const message = error instanceof Error ? error.message : 'No se pudo actualizar la cuota.'
        return NextResponse.json({ error: status === 500 ? 'No se pudo actualizar la cuota.' : message }, { status })
    }
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Las cuotas no se eliminan porque pueden afectar Caja y liquidaciones. Corregí el monto si aún está pendiente.' },
        { status: 409 },
    )
}
