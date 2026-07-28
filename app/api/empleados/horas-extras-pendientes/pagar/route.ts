import { NextResponse } from 'next/server'

import { eventBus } from '@/lib/events'
import { etiquetaSemanaOrigen } from '@/lib/payroll/horasExtrasAdeudadas'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH } from '@/lib/rrhh/fechas'
import { CajaService } from '@/lib/services/caja.service'

export async function POST(request: Request) {
    try {
        const body = await request.json() as Record<string, unknown>
        const id = typeof body.id === 'string' ? body.id : ''
        const cajaId = typeof body.cajaId === 'string' ? body.cajaId : ''
        if (!id || !cajaId) {
            return NextResponse.json({ error: 'La deuda y la caja de pago son requeridas.' }, { status: 400 })
        }

        const liquidacion = await prisma.$transaction(async tx => {
            const lockKey = `hora-extra-pendiente:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const pendiente = await tx.horaExtraPendiente.findUnique({
                where: { id },
                include: { empleado: true },
            })
            if (!pendiente || pendiente.pagado) throw new Error('La deuda no existe o ya fue pagada.')
            if (!Number.isFinite(pendiente.cantidadHoras) || pendiente.cantidadHoras <= 0
                || !Number.isFinite(pendiente.montoCalculado) || pendiente.montoCalculado <= 0) {
                throw new Error('La deuda tiene horas o importe inválidos y no puede pagarse.')
            }

            const caja = await tx.saldoCaja.findUnique({ where: { tipo: cajaId } })
            if (!caja) throw new Error(`La caja '${cajaId}' no existe en el sistema.`)

            const fechaOrigen = fechaClaveRRHH(pendiente.fechaOrigen)
            const semanaOrigen = etiquetaSemanaOrigen(fechaOrigen)
            const nombreEmpleado = `${pendiente.empleado.nombre} ${pendiente.empleado.apellido || ''}`.trim()
            const nuevaLiquidacion = await tx.liquidacionSueldo.create({
                data: {
                    empleadoId: pendiente.empleadoId,
                    periodo: `Pago de horas extras adeudadas · ${semanaOrigen}`,
                    sueldoProporcional: 0,
                    horasNormales: 0,
                    montoHorasNormales: 0,
                    horasExtras: pendiente.cantidadHoras,
                    montoHorasExtras: pendiente.montoCalculado,
                    horasFeriado: 0,
                    montoHorasFeriado: 0,
                    descuentosPrestamos: 0,
                    totalNeto: pendiente.montoCalculado,
                    estado: 'pagado',
                    tipo: 'HORAS_EXTRAS_ADEUDADAS',
                    desglose: {
                        origen: 'HORAS_EXTRAS_ADEUDADAS',
                        deudaId: pendiente.id,
                        fechaOrigen,
                        semanaOrigen,
                        cantidadHoras: pendiente.cantidadHoras,
                        monto: pendiente.montoCalculado,
                        valorHoraExtra: pendiente.montoCalculado / pendiente.cantidadHoras,
                        observaciones: pendiente.observaciones,
                    },
                },
            })

            await CajaService.createMovimientoEnTx(tx, {
                tipo: 'egreso',
                concepto: 'pago_horas_extras_adeudadas',
                monto: pendiente.montoCalculado,
                cajaOrigen: cajaId,
                descripcion: `Horas extras adeudadas: ${nombreEmpleado} - ${semanaOrigen} (ID: ${nuevaLiquidacion.id})`,
            })

            await tx.horaExtraPendiente.update({
                where: { id: pendiente.id },
                data: { pagado: true, liquidacionId: nuevaLiquidacion.id },
            })
            return nuevaLiquidacion
        })

        eventBus.emit('liquidacion:created', {
            liquidacionId: liquidacion.id,
            empleadoId: liquidacion.empleadoId,
            monto: liquidacion.totalNeto,
        })
        return NextResponse.json(liquidacion, { status: 201 })
    } catch (error) {
        console.error('Error pagando horas extras adeudadas:', error)
        const mensaje = error instanceof Error ? error.message : 'No se pudo registrar el pago.'
        const status = mensaje.includes('no existe') || mensaje.includes('ya fue pagada') ? 409 : 400
        return NextResponse.json({ error: mensaje }, { status })
    }
}
