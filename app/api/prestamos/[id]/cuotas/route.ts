import { NextResponse } from 'next/server'

import { CajaService } from '@/lib/services/caja.service'
import { sumarMesesFechaCivil, validarMontoPrestamo } from '@/lib/payroll/prestamos'
import { prisma } from '@/lib/prisma'
import { fechaClaveRRHH, instanteRRHH, sumarDiasRRHH } from '@/lib/rrhh/fechas'

const CAJAS_VALIDAS = new Set(['caja_chica', 'caja_chica_local', 'mercado_pago', 'mercado_pago_juani', 'mercaderia', 'ninguna'])

class CuotaApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params
        const body = await request.json()
        const monto = validarMontoPrestamo(body.monto)
        const cajaOrigen = String(body.cajaOrigen || '')
        const detalle = typeof body.detalle === 'string' ? body.detalle.trim().slice(0, 200) : ''

        if (!CAJAS_VALIDAS.has(cajaOrigen)) {
            throw new CuotaApiError('Seleccioná un origen o concepto válido.', 400)
        }

        const nuevaCuota = await prisma.$transaction(async tx => {
            const lockKey = `prestamo:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const prestamo = await tx.prestamoEmpleado.findUnique({
                where: { id },
                include: {
                    empleado: { select: { nombre: true, apellido: true } },
                    cuotas: {
                        orderBy: [
                            { fechaVencimiento: 'asc' },
                            { numeroCuota: 'asc' },
                        ],
                    },
                },
            })
            if (!prestamo) throw new CuotaApiError('Préstamo no encontrado.', 404)
            if (prestamo.estado === 'anulado') {
                throw new CuotaApiError('El préstamo está anulado y no admite nuevas cuotas.', 409)
            }

            const liquidacionLockKey = `liquidacion:${prestamo.empleadoId}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${liquidacionLockKey}))::text AS lock_result`

            if (!prestamo.cuotas.some(cuota => cuota.estado === 'pendiente')) {
                throw new CuotaApiError('El préstamo ya está saldado. Registrá un préstamo nuevo para conservar el historial cerrado.', 409)
            }

            const ultimaCuota = prestamo.cuotas.at(-1)
            const nextNumero = prestamo.cuotas.reduce((maximo, cuota) => Math.max(maximo, cuota.numeroCuota), 0) + 1
            const ultimaFecha = ultimaCuota ? fechaClaveRRHH(ultimaCuota.fechaVencimiento) : fechaClaveRRHH(new Date())
            const nextFecha = ultimaCuota
                ? prestamo.frecuencia === 'SEMANAL'
                    ? sumarDiasRRHH(ultimaFecha, 7)
                    : sumarMesesFechaCivil(ultimaFecha, 1)
                : ultimaFecha
            const [anio, mes] = nextFecha.split('-')

            const cuota = await tx.cuotaPrestamo.create({
                data: {
                    prestamoId: id,
                    numeroCuota: nextNumero,
                    monto,
                    mesAnio: `${mes}-${anio}`,
                    fechaVencimiento: instanteRRHH(nextFecha),
                    estado: 'pendiente',
                    origenEntrega: cajaOrigen,
                },
            })

            const conceptoDetalle = detalle || (cajaOrigen === 'mercaderia' ? 'Retiro de mercadería' : 'Ampliación')
            const observaciones = prestamo.observaciones
                ? `${prestamo.observaciones} | Cuota ${nextNumero}: ${conceptoDetalle}`
                : `Cuota ${nextNumero}: ${conceptoDetalle}`

            await tx.prestamoEmpleado.update({
                where: { id },
                data: {
                    montoTotal: Math.round((prestamo.montoTotal + monto) * 100) / 100,
                    cantidadCuotas: prestamo.cuotas.length + 1,
                    estado: 'activo',
                    observaciones: observaciones.slice(0, 500),
                },
            })

            if (cajaOrigen !== 'mercaderia' && cajaOrigen !== 'ninguna') {
                await CajaService.createMovimiento({
                    tipo: 'egreso',
                    concepto: 'prestamo_empleado',
                    monto,
                    cajaOrigen,
                    prestamoId: id,
                    cuotaPrestamoId: cuota.id,
                    descripcion: `Ampliación préstamo: ${prestamo.empleado.nombre} ${prestamo.empleado.apellido || ''} (Cuota ${nextNumero})${detalle ? ` - ${detalle}` : ''}`,
                }, tx)
            }

            return cuota
        })

        return NextResponse.json(nuevaCuota, { status: 201 })
    } catch (error) {
        console.error('Error al agregar cuota:', error)
        const status = error instanceof CuotaApiError ? error.status : error instanceof Error && error.message.includes('monto') ? 400 : 500
        const message = error instanceof Error ? error.message : 'No se pudo agregar la cuota.'
        return NextResponse.json({ error: status === 500 ? 'No se pudo agregar la cuota.' : message }, { status })
    }
}
