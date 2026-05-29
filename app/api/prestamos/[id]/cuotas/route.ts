import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CajaService } from '@/lib/services/caja.service'

// POST /api/prestamos/[id]/cuotas
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { monto, cajaOrigen, detalle } = body

        if (!monto || parseFloat(monto) <= 0) {
            return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
        }

        const validBoxes = ['caja_chica', 'caja_chica_local', 'mercado_pago', 'mercado_pago_juani', 'mercaderia', 'ninguna']
        if (!cajaOrigen || !validBoxes.includes(cajaOrigen)) {
            return NextResponse.json({ error: 'Debe especificar una opción válida (Caja Chica, Mercado Pago, Retiro de Mercadería o Ninguna)' }, { status: 400 })
        }

        const numericMonto = parseFloat(monto)

        const result = await prisma.$transaction(async (tx) => {
            // 1. Obtener el préstamo
            const prestamo = await tx.prestamoEmpleado.findUnique({
                where: { id },
                include: { 
                    empleado: { select: { nombre: true, apellido: true } },
                    cuotas: true
                }
            })

            if (!prestamo) {
                throw new Error('Préstamo no encontrado')
            }

            // 2. Determinar número de cuota
            let nextNumero = 1
            if (prestamo.cuotas.length > 0) {
                nextNumero = Math.max(...prestamo.cuotas.map(c => c.numeroCuota)) + 1
            }

            // 3. Determinar fecha de vencimiento
            let nextFecha = new Date()
            if (prestamo.cuotas.length > 0) {
                const maxFecha = new Date(Math.max(...prestamo.cuotas.map(c => new Date(c.fechaVencimiento).getTime())))
                nextFecha = new Date(maxFecha)
                if (prestamo.frecuencia === 'SEMANAL') {
                    nextFecha.setDate(maxFecha.getDate() + 7)
                } else {
                    nextFecha.setMonth(maxFecha.getMonth() + 1)
                }
            }

            const mesAnio = `${(nextFecha.getMonth() + 1).toString().padStart(2, '0')}-${nextFecha.getFullYear()}`

            // 4. Crear la cuota
            const nuevaCuota = await tx.cuotaPrestamo.create({
                data: {
                    prestamoId: id,
                    numeroCuota: nextNumero,
                    monto: numericMonto,
                    mesAnio,
                    fechaVencimiento: nextFecha,
                    estado: 'pendiente'
                }
            })

            // 5. Recalcular préstamo
            const updatedObservaciones = prestamo.observaciones
                ? `${prestamo.observaciones} | Cuota ${nextNumero}: ${detalle || (cajaOrigen === 'mercaderia' ? 'Retiro Mercadería' : 'Ampliación')}`
                : `Cuota ${nextNumero}: ${detalle || (cajaOrigen === 'mercaderia' ? 'Retiro Mercadería' : 'Ampliación')}`

            await tx.prestamoEmpleado.update({
                where: { id },
                data: {
                    montoTotal: prestamo.montoTotal + numericMonto,
                    cantidadCuotas: prestamo.cantidadCuotas + 1,
                    estado: 'activo', // Vuelve a estar activo ya que agregamos una cuota pendiente
                    observaciones: updatedObservaciones.substring(0, 500) // Limitar tamaño de string defensivamente
                }
            })

            // 6. Si no es mercadería ni ninguna, registrar movimiento de caja
            if (cajaOrigen !== 'mercaderia' && cajaOrigen !== 'ninguna') {
                const desc = `Ampliación Préstamo: ${prestamo.empleado.nombre} ${prestamo.empleado.apellido || ''} (Cuota ${nextNumero})${detalle ? ` - ${detalle}` : ''}`
                await CajaService.createMovimiento({
                    tipo: 'egreso',
                    concepto: 'prestamo_empleado',
                    monto: numericMonto,
                    cajaOrigen: cajaOrigen,
                    descripcion: desc,
                }, tx)
            }

            return nuevaCuota
        })

        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('Error al agregar cuota:', error)
        return NextResponse.json({ error: error.message || 'Error al agregar cuota' }, { status: 500 })
    }
}
