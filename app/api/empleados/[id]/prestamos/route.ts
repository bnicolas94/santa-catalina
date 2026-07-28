import { NextResponse } from 'next/server'

import { CajaService } from '@/lib/services/caja.service'
import { prisma } from '@/lib/prisma'
import {
    dividirMontoEnCuotas,
    sumarMesesFechaCivil,
    validarCantidadCuotas,
    validarMontoPrestamo,
} from '@/lib/payroll/prestamos'
import { fechaClaveRRHH, instanteRRHH, sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

const FRECUENCIAS = new Set(['SEMANAL', 'MENSUAL'])
const MODOS_INICIO = new Set(['INMEDIATO', 'FECHA_ESPECIFICA', 'AL_FINALIZAR_ANTERIOR'])
const CAJAS_VALIDAS = new Set(['caja_chica', 'caja_chica_local', 'mercado_pago', 'mercado_pago_juani', 'mercaderia'])

class PrestamoApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message)
    }
}

function fechaCuota(fechaBase: string, indice: number, frecuencia: string): string {
    return frecuencia === 'SEMANAL'
        ? sumarDiasRRHH(fechaBase, indice * 7)
        : sumarMesesFechaCivil(fechaBase, indice)
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params
        const prestamos = await prisma.prestamoEmpleado.findMany({
            where: { empleadoId: id },
            orderBy: { fechaSolicitud: 'desc' },
            include: {
                cuotas: {
                    orderBy: [
                        { fechaVencimiento: 'asc' },
                        { numeroCuota: 'asc' },
                    ],
                },
                anuladoPor: {
                    select: { id: true, nombre: true, apellido: true },
                },
                movimientosCaja: {
                    select: {
                        id: true,
                        tipo: true,
                        concepto: true,
                        monto: true,
                        cajaOrigen: true,
                        fecha: true,
                        movimientoReversaDeId: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        })
        return NextResponse.json(prestamos)
    } catch (error) {
        console.error('Error fetching prestamos:', error)
        return NextResponse.json({ error: 'Error al obtener los préstamos.' }, { status: 500 })
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params
        const body = await request.json()
        const montoTotal = validarMontoPrestamo(body.montoTotal)
        const cantidadCuotas = validarCantidadCuotas(body.cantidadCuotas)
        const frecuencia = String(body.frecuencia || 'SEMANAL')
        const modoInicio = String(body.modoInicio || 'INMEDIATO')
        const cajaOrigen = String(body.cajaOrigen || '')
        const observaciones = typeof body.observaciones === 'string'
            ? body.observaciones.trim().slice(0, 500)
            : ''

        if (!FRECUENCIAS.has(frecuencia)) throw new PrestamoApiError('La frecuencia seleccionada no es válida.', 400)
        if (!MODOS_INICIO.has(modoInicio)) throw new PrestamoApiError('El modo de inicio seleccionado no es válido.', 400)
        if (!CAJAS_VALIDAS.has(cajaOrigen)) throw new PrestamoApiError('Seleccioná una caja de origen válida.', 400)

        let fechaBase = fechaClaveRRHH(new Date())
        if (modoInicio === 'FECHA_ESPECIFICA') {
            if (!body.fechaInicio) throw new PrestamoApiError('Seleccioná la fecha de la primera cuota.', 400)
            fechaBase = validarFechaCivilRRHH(String(body.fechaInicio))
        }

        const montosCuotas = dividirMontoEnCuotas(montoTotal, cantidadCuotas)
        const prestamo = await prisma.$transaction(async tx => {
            const lockKey = `prestamos-empleado:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock_result`

            const empleado = await tx.empleado.findUnique({
                where: { id },
                select: { nombre: true, apellido: true },
            })
            if (!empleado) throw new PrestamoApiError('Empleado no encontrado.', 404)

            const liquidacionLockKey = `liquidacion:${id}`
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${liquidacionLockKey}))::text AS lock_result`

            if (modoInicio === 'AL_FINALIZAR_ANTERIOR') {
                const ultimaPendiente = await tx.cuotaPrestamo.findFirst({
                    where: {
                        prestamo: { empleadoId: id },
                        estado: 'pendiente',
                        liquidacionId: null,
                    },
                    orderBy: { fechaVencimiento: 'desc' },
                })
                if (ultimaPendiente) {
                    const ultimaFecha = fechaClaveRRHH(ultimaPendiente.fechaVencimiento)
                    fechaBase = frecuencia === 'SEMANAL'
                        ? sumarDiasRRHH(ultimaFecha, 7)
                        : sumarMesesFechaCivil(ultimaFecha, 1)
                }
            }

            const nuevoPrestamo = await tx.prestamoEmpleado.create({
                data: {
                    empleadoId: id,
                    montoTotal,
                    cantidadCuotas,
                    frecuencia,
                    modoInicio,
                    observaciones: observaciones || null,
                    origenEntrega: cajaOrigen,
                },
            })

            if (cajaOrigen !== 'mercaderia') {
                await CajaService.createMovimiento({
                    tipo: 'egreso',
                    concepto: 'prestamo_empleado',
                    monto: montoTotal,
                    cajaOrigen,
                    prestamoId: nuevoPrestamo.id,
                    descripcion: `Préstamo a empleado: ${empleado.nombre} ${empleado.apellido || ''} (${cantidadCuotas} cuotas)${observaciones ? ` - ${observaciones}` : ''}`,
                }, tx)
            }

            await tx.cuotaPrestamo.createMany({
                data: montosCuotas.map((monto, indice) => {
                    const fecha = fechaCuota(fechaBase, indice, frecuencia)
                    const [anio, mes] = fecha.split('-')
                    return {
                        prestamoId: nuevoPrestamo.id,
                        numeroCuota: indice + 1,
                        monto,
                        mesAnio: `${mes}-${anio}`,
                        fechaVencimiento: instanteRRHH(fecha),
                    }
                }),
            })

            return tx.prestamoEmpleado.findUnique({
                where: { id: nuevoPrestamo.id },
                include: { cuotas: { orderBy: { numeroCuota: 'asc' } } },
            })
        })

        return NextResponse.json(prestamo, { status: 201 })
    } catch (error) {
        console.error('Error creating prestamo:', error)
        const esValidacion = error instanceof Error && /(monto|cuotas|fecha).*(debe|inválid|límite)|debe.*(monto|cuotas|fecha)/i.test(error.message)
        const status = error instanceof PrestamoApiError ? error.status : esValidacion ? 400 : 500
        const message = error instanceof Error ? error.message : 'Error al crear el préstamo.'
        return NextResponse.json({ error: status === 500 ? 'No se pudo crear el préstamo.' : message }, { status })
    }
}
