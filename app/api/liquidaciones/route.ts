import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Modelo Simplificado de Liquidación
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, periodo, fechaInicio, fechaFin, cajaId, concepto, manualData } = body

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

        let sueldoProporcional = 0
        let horasNormales = 0
        let montoHsNorm = 0
        let horasExtras = 0
        let montoHsExtra = 0
        let horasFeriado = 0
        let montoHsFeriado = 0
        let deduccionCuotas = 0
        let diasTrabajados = 0

        if (manualData) {
            // Liquidación Express / Manual
            sueldoProporcional = manualData.sueldoBase || 0
            horasExtras = manualData.horasExtras || 0
            montoHsExtra = manualData.montoHsExtras || 0
            deduccionCuotas = manualData.descuentoPrestamos || 0
            // No calculamos días trabajados, usamos un placeholder o lo que venga
            diasTrabajados = manualData.diasTrabajados || 0
        } else {
            // Cálculo Automático basado en fichadas
            const fichadas = empleado.fichadas || []
            const diasSet = new Set<string>()
            fichadas.forEach((f: any) => {
                if (f.tipo !== 'ausencia') {
                    const d = new Date(f.fechaHora)
                    diasSet.add(d.toISOString().split('T')[0])
                }
            })
            diasTrabajados = diasSet.size

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

            sueldoProporcional = sueldoDia * diasTrabajados

            // Costos por hora (si estuvieran calculadas las horas, que aquí no se están extrayendo del todo)
            const valorHora = empleado.valorHoraNormal || (empleado.sueldoBaseMensual / 160)
            montoHsNorm = horasNormales * valorHora
            montoHsExtra = horasExtras * valorHora * (1 + (empleado.porcentajeHoraExtra / 100))
            montoHsFeriado = horasFeriado * valorHora * (1 + (empleado.porcentajeFeriado / 100))

            // Descuentos por Préstamos Automáticos
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    deduccionCuotas += primeraPendiente.monto
                }
            })
        }

        const neto = sueldoProporcional + montoHsNorm + montoHsExtra + montoHsFeriado - deduccionCuotas

        // Cuotas a afectar (solo si no es manual o si queremos integrarlas)
        // Para simplificar, si es manual, el usuario carga el descuento. 
        // Si no es manual, buscamos las cuotas.
        const cuotasAfectadas: any[] = []
        if (!manualData) {
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    cuotasAfectadas.push(primeraPendiente.id)
                }
            })
        }

        // Crear la liquidación en DB
        const liquidacion = await prisma.liquidacionSueldo.create({
            data: {
                empleadoId: empleado.id,
                periodo: manualData ? periodo : `${periodo} (${diasTrabajados} d. trab.)`,
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

            await prisma.movimientoCaja.create({
                data: {
                    tipo: 'egreso',
                    concepto: conceptoFinal,
                    monto: neto,
                    cajaOrigen: cajaId,
                    descripcion: `Liquidación Sueldo: ${empleado.nombre} ${empleado.apellido || ''} - Periodo: ${periodo} (ID: ${liquidacion.id})`,
                }
            })

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
