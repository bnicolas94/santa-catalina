import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Modelo Simplificado de Liquidación
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, periodo, fechaInicio, fechaFin, cajaId, concepto } = body

        if (!empleadoId || !periodo || !fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Faltan datos para la liquidación' }, { status: 400 })
        }

        const empleado = await prisma.empleado.findUnique({
            where: { id: empleadoId },
            include: {
                fichadas: {
                    where: {
                        fechaHora: { gte: new Date(fechaInicio), lte: new Date(fechaFin) }
                    },
                    orderBy: { fechaHora: 'asc' }
                },
                prestamos: {
                    where: { estado: 'activo' },
                    include: {
                        cuotas: {
                            where: { estado: 'pendiente' },
                            orderBy: { numeroCuota: 'asc' }
                        }
                    }
                }
            }
        })

        if (!empleado) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
        }

        // Calcular días trabajados usando fichadas (solo contamos días distintos)
        const fichadas = empleado.fichadas || []
        const diasSet = new Set<string>()
        fichadas.forEach((f: any) => {
            if (f.tipo !== 'ausencia') {
                const d = new Date(f.fechaHora)
                diasSet.add(d.toISOString().split('T')[0])
            }
        })
        const diasTrabajados = diasSet.size

        // Cálculo Base 
        let sueldoProporcional = 0
        let sueldoDia = 0
        let diasEsperados = 30

        if (empleado.cicloPago === 'MENSUAL') {
            diasEsperados = 30
            sueldoDia = empleado.sueldoBaseMensual / diasEsperados
        } else if (empleado.cicloPago === 'QUINCENAL') {
            diasEsperados = 15
            sueldoDia = (empleado.sueldoBaseMensual / 2) / diasEsperados
        } else { // SEMANAL
            diasEsperados = 6
            sueldoDia = (empleado.sueldoBaseMensual / 4.3) / diasEsperados
        }

        // Proporcional por dias trabajados
        sueldoProporcional = sueldoDia * diasTrabajados

        let horasNormales = 0
        let horasExtras = 0
        let horasFeriado = 0

        // Costos por hora
        const valorHora = empleado.valorHoraNormal || (empleado.sueldoBaseMensual / 160)
        const montoHsNorm = horasNormales * valorHora
        const montoHsExtra = horasExtras * valorHora * (1 + (empleado.porcentajeHoraExtra / 100))
        const montoHsFeriado = horasFeriado * valorHora * (1 + (empleado.porcentajeFeriado / 100))

        // Descuentos por Préstamos del Periodo
        let deduccionCuotas = 0
        const cuotasAfectadas: any[] = []

        empleado.prestamos.forEach((prestamo: any) => {
            const primeraPendiente = prestamo.cuotas[0]
            if (primeraPendiente) {
                deduccionCuotas += primeraPendiente.monto
                cuotasAfectadas.push(primeraPendiente.id)
            }
        })

        const neto = sueldoProporcional + montoHsNorm + montoHsExtra + montoHsFeriado - deduccionCuotas

        // Crear la liquidación en DB
        const liquidacion = await prisma.liquidacionSueldo.create({
            data: {
                empleadoId: empleado.id,
                periodo: `${periodo} (${diasTrabajados} d. trab.)`,
                sueldoProporcional,
                horasNormales,
                montoHorasNormales: montoHsNorm,
                horasExtras,
                montoHorasExtras: montoHsExtra,
                horasFeriado,
                montoHorasFeriado: montoHsFeriado,
                descuentosPrestamos: deduccionCuotas,
                totalNeto: neto,
                estado: 'pagado'
            }
        })

        // Marcar las cuotas como pagadas 
        for (const cuotaId of cuotasAfectadas) {
            await prisma.cuotaPrestamo.update({
                where: { id: cuotaId },
                data: {
                    estado: 'pagada',
                    fechaPago: new Date(),
                    liquidacionId: liquidacion.id
                }
            })
        }

        // --- REGISTRO EN CAJA ---
        if (cajaId && neto > 0) {
            const conceptoFinal = concepto || 'pago_sueldo'

            // Crear movimiento de egreso
            await prisma.movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: conceptoFinal,
                    monto: neto,
                    cajaOrigen: cajaId,
                    descripcion: `Liquidación Sueldo: ${empleado.nombre} ${empleado.apellido || ''} - Periodo: ${periodo} (ID: ${liquidacion.id})`,
                }
            })

            // Descontar del saldo de la caja
            await prisma.saldoCaja.update({
                where: { tipo: cajaId },
                data: {
                    saldo: { decrement: neto }
                }
            })
        }

        return NextResponse.json(liquidacion, { status: 201 })
    } catch (error) {
        console.error('Error procesando liquidacion:', error)
        return NextResponse.json({ error: 'Error interno en la liquidación' }, { status: 500 })
    }
}

// GET /api/liquidaciones — Listar liquidaciones del empleado
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')

        const liquidaciones = await prisma.liquidacionSueldo.findMany({
            where: empleadoId ? { empleadoId } : {},
            orderBy: { fechaGeneracion: 'desc' },
            include: {
                cuotasDescontadas: true
            }
        })

        return NextResponse.json(liquidaciones)
    } catch (error) {
        console.error('Error listando liquidaciones:', error)
        return NextResponse.json({ error: 'Error al listar liquidaciones' }, { status: 500 })
    }
}

// DELETE /api/liquidaciones — Revertir liquidación
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID de liquidación requerido' }, { status: 400 })
        }

        // Buscar la liquidación para saber el monto y empleado
        const liq = await prisma.liquidacionSueldo.findUnique({
            where: { id },
            include: { cuotasDescontadas: true }
        })

        if (!liq) {
            return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 })
        }

        // 1. Revertir Cuotas de Préstamos
        if (liq.cuotasDescontadas.length > 0) {
            await prisma.cuotaPrestamo.updateMany({
                where: { liquidacionId: id },
                data: {
                    estado: 'pendiente',
                    fechaPago: null,
                    liquidacionId: null
                }
            })
        }

        // 2. Buscar movimiento de caja asociado (usamos el ID en la descripción)
        const movCaja = await prisma.movimientoCaja.findFirst({
            where: {
                descripcion: { contains: `(ID: ${id})` },
                tipo: 'egreso'
            }
        })

        if (movCaja && movCaja.cajaOrigen) {
            // Devolver dinero al saldo
            await prisma.saldoCaja.update({
                where: { tipo: movCaja.cajaOrigen },
                data: {
                    saldo: { increment: movCaja.monto }
                }
            })
            // Borrar el movimiento
            await prisma.movimientoCaja.delete({
                where: { id: movCaja.id }
            })
        }

        // 3. Borrar la liquidación
        await prisma.liquidacionSueldo.delete({
            where: { id }
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error eliminando liquidación:', error)
        return NextResponse.json({ error: 'Error al eliminar la liquidación' }, { status: 500 })
    }
}
