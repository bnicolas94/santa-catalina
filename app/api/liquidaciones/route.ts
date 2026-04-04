import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Modelo Simplificado de Liquidación
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, periodo, fechaInicio, fechaFin, cajaId, concepto, manualData, calculatedData } = body

        if (!empleadoId || !periodo) {
            return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
        }

        // Verificamos si ya existe una liquidación PAGADA para este empleado y periodo
        const existente = await prisma.liquidacionSueldo.findFirst({
            where: {
                empleadoId,
                periodo,
                estado: 'pagado'
            }
        })

        if (existente) {
            return NextResponse.json({ error: `El empleado ya tiene una liquidación pagada para el periodo ${periodo}.` }, { status: 400 })
        }

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
        let ajusteHorasExtras = 0

        if (manualData) {
            // Liquidación Express / Manual
            sueldoProporcional = manualData.sueldoBase || 0
            horasExtras = manualData.horasExtras || 0
            montoHsExtra = manualData.montoHsExtras || 0
            deduccionCuotas = manualData.descuentoPrestamos || 0
            // No calculamos días trabajados, usamos un placeholder o lo que venga
            diasTrabajados = manualData.diasTrabajados || 0
        } else if (calculatedData) {
            // Liquidación Automática (vía WeeklyPayrollModal)
            sueldoProporcional = calculatedData.sueldoBase || 0
            horasNormales = calculatedData.horasNormales || 0
            montoHsNorm = calculatedData.montoHorasNormales || 0
            horasExtras = calculatedData.horasExtras || 0
            montoHsExtra = calculatedData.montoHorasExtras || 0
            horasFeriado = calculatedData.horasFeriado || 0
            montoHsFeriado = calculatedData.montoHorasFeriado || 0
            deduccionCuotas = calculatedData.descuentoPrestamos || 0
            diasTrabajados = calculatedData.diasTrabajados || 0
            ajusteHorasExtras = calculatedData.ajusteHorasExtras || 0
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

        const cuotasAfectadas: any[] = []
        if (!manualData && !calculatedData) {
            empleado.prestamos.forEach((prestamo: any) => {
                const primeraPendiente = prestamo.cuotas[0]
                if (primeraPendiente) {
                    cuotasAfectadas.push(primeraPendiente.id)
                }
            })
        }

        // Antes de crear la liquidación pagada, eliminamos cualquier borrador existente para este periodo y empleado
        await prisma.liquidacionSueldo.deleteMany({
            where: {
                empleadoId: empleado.id,
                periodo: periodo,
                estado: 'borrador'
            }
        })

        // Crear la liquidación en DB
        const liquidacion = await prisma.liquidacionSueldo.create({
            data: {
                empleadoId: empleado.id,
                periodo: (manualData || calculatedData) ? periodo : `${periodo} (${diasTrabajados} d. trab.)`,
                sueldoProporcional,
                horasNormales,
                montoHorasNormales: montoHsNorm,
                horasExtras,
                montoHorasExtras: montoHsExtra,
                horasFeriado,
                montoHorasFeriado: montoHsFeriado,
                ajusteHorasExtras,
                descuentosPrestamos: deduccionCuotas,
                totalNeto: neto,
                estado: 'pagado',
                desglose: calculatedData?.desglosePorDia || null
            }
        })

        // Marcar las cuotas como pagadas 
        // Si es calculatedData, también debemos buscar las cuotas afectadas si hubo descuento
        const finalCuotasAfectadas = [...cuotasAfectadas]
        if (calculatedData && calculatedData.descuentoPrestamos > 0) {
            const cp = await prisma.cuotaPrestamo.findMany({
                where: { prestamo: { empleadoId }, estado: 'pendiente' },
                orderBy: { numeroCuota: 'asc' },
                take: 1 // Asumimos 1 cuota por liquidación
            })
            if (cp[0]) finalCuotasAfectadas.push(cp[0].id)
        }

        for (const cuotaId of finalCuotasAfectadas) {
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

            // Verificar si la caja existe
            const caja = await prisma.saldoCaja.findUnique({
                where: { tipo: cajaId }
            })

            if (!caja) {
                return NextResponse.json({ error: `La caja '${cajaId}' no existe en el sistema.` }, { status: 400 })
            }

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
    } catch (error: any) {
        console.error('Error procesando liquidacion:', error)
        return NextResponse.json({ error: `Error en la liquidación: ${error.message || 'Error interno'}` }, { status: 500 })
    }
}

// GET /api/liquidaciones — Listar liquidaciones del empleado
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleadoId = searchParams.get('empleadoId')

        const liquidaciones = await prisma.liquidacionSueldo.findMany({
            where: empleadoId ? { 
                empleadoId,
                estado: 'pagado' 
            } : {
                estado: 'pagado'
            },
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
