import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import {
    planificarCancelacionPrestamo,
    validarMotivoAnulacionPrestamo,
    validarPrestamoAnulable,
} from '@/lib/payroll/prestamos'
import { prisma } from '@/lib/prisma'
import { CajaService } from '@/lib/services/caja.service'

class AnulacionPrestamoError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions)
        const usuario = session?.user as { id?: string; rol?: string; name?: string } | undefined
        if (!usuario?.id) throw new AnulacionPrestamoError('No autenticado.', 401)
        if (usuario.rol !== 'ADMIN') throw new AnulacionPrestamoError('Sólo un administrador puede anular préstamos.', 403)

        const { id } = await params
        const body = await request.json()
        const motivo = validarMotivoAnulacionPrestamo(body.motivo)

        const prestamoAnulado = await prisma.$transaction(async tx => {
            const prestamoLockKey = `prestamo:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${prestamoLockKey}))::text AS lock_result`

            const referencia = await tx.prestamoEmpleado.findUnique({
                where: { id },
                select: { empleadoId: true },
            })
            if (!referencia) throw new AnulacionPrestamoError('Préstamo no encontrado.', 404)

            const liquidacionLockKey = `liquidacion:${referencia.empleadoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${liquidacionLockKey}))::text AS lock_result`

            const prestamo = await tx.prestamoEmpleado.findUnique({
                where: { id },
                include: {
                    empleado: { select: { nombre: true, apellido: true } },
                    cuotas: true,
                    movimientosCaja: {
                        where: { movimientoReversaDeId: null },
                        include: { movimientoReversion: { select: { id: true } } },
                        orderBy: { createdAt: 'asc' },
                    },
                },
            })
            if (!prestamo) throw new AnulacionPrestamoError('Préstamo no encontrado.', 404)

            if (prestamo.estado === 'anulado' || prestamo.estado === 'cancelado_saldo') {
                throw new AnulacionPrestamoError('El préstamo ya fue cerrado.', 409)
            }

            const plan = planificarCancelacionPrestamo(prestamo.cuotas)
            if (plan.tipo === 'anulacion_total') {
                validarPrestamoAnulable({
                    estado: prestamo.estado,
                    origenEntrega: prestamo.origenEntrega,
                    cuotas: prestamo.cuotas,
                    movimientos: prestamo.movimientosCaja,
                })

                for (const movimiento of prestamo.movimientosCaja) {
                    await CajaService.createMovimientoEnTx(tx, {
                        tipo: 'ingreso',
                        concepto: 'anulacion_prestamo_empleado',
                        monto: movimiento.monto,
                        cajaOrigen: movimiento.cajaOrigen,
                        prestamoId: prestamo.id,
                        movimientoReversaDeId: movimiento.id,
                        descripcion: `Anulación préstamo: ${prestamo.empleado.nombre} ${prestamo.empleado.apellido || ''} - ${motivo} (Movimiento original: ${movimiento.id})`,
                    })
                }
            }

            await tx.cuotaPrestamo.updateMany({
                where: { prestamoId: prestamo.id, estado: 'pendiente', liquidacionId: null },
                data: { estado: 'anulada' },
            })

            const actualizado = await tx.prestamoEmpleado.update({
                where: { id: prestamo.id },
                data: {
                    estado: plan.tipo === 'anulacion_total' ? 'anulado' : 'cancelado_saldo',
                    motivoAnulacion: motivo,
                    anuladoAt: new Date(),
                    anuladoPorId: usuario.id,
                },
                include: {
                    cuotas: { orderBy: { numeroCuota: 'asc' } },
                    anuladoPor: { select: { id: true, nombre: true, apellido: true } },
                    movimientosCaja: { orderBy: { createdAt: 'asc' } },
                },
            })
            return {
                ...actualizado,
                tipoCierre: plan.tipo,
                cuotasCanceladas: plan.cantidadCuotas,
                montoCancelado: plan.monto,
            }
        })

        return NextResponse.json(prestamoAnulado)
    } catch (error) {
        console.error('Error anulando préstamo:', error)
        const esMotivoInvalido = error instanceof Error && /motivo de anulación/i.test(error.message)
        const esConflicto = error instanceof Error && /(préstamo|movimiento|cuota|Caja)/i.test(error.message)
        const status = error instanceof AnulacionPrestamoError ? error.status : esMotivoInvalido ? 400 : esConflicto ? 409 : 500
        const message = error instanceof Error ? error.message : 'No se pudo anular el préstamo.'
        return NextResponse.json({ error: status === 500 ? 'No se pudo anular el préstamo.' : message }, { status })
    }
}
