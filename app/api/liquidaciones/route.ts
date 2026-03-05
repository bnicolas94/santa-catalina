import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Modelo Simplificado de Liquidación
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { empleadoId, periodo, fechaInicio, fechaFin } = body

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

        // Lógica súper simplificada de horas:
        // En una implementación real, calcularíamos pares (entrada->salida) por día, 
        // veríamos si exceden sus horas diarias esperadas o si caen en feriado.
        // Aquí asumimos variables fijas o mockeadas para el propósito inicial del módulo.

        // Cálculo Base 
        let sueldoProporcional = 0
        if (empleado.cicloPago === 'MENSUAL') {
            sueldoProporcional = empleado.sueldoBaseMensual
        } else if (empleado.cicloPago === 'QUINCENAL') {
            sueldoProporcional = empleado.sueldoBaseMensual / 2
        } else { // SEMANAL
            sueldoProporcional = empleado.sueldoBaseMensual / 4.3 // 4.3 semanas promedio por mes
        }

        // Simulación: sumamos las horas basado en la diferencia de las fichadas 
        // y consideramos que todo lo que exceda empleado.horasTrabajoDiarias es Extra.
        let horasNormales = 0
        let horasExtras = 0
        let horasFeriado = 0 // Requiere tabla de feriados o marcación manual

        // ... (Aquí iría la lógica compleja de pares de reloj) ...

        // Costos por hora
        const valorHora = empleado.valorHoraNormal || (empleado.sueldoBaseMensual / 160) // Asumiendo 160hs mes
        const montoHsNorm = horasNormales * valorHora
        const montoHsExtra = horasExtras * valorHora * (1 + (empleado.porcentajeHoraExtra / 100))
        const montoHsFeriado = horasFeriado * valorHora * (1 + (empleado.porcentajeFeriado / 100))

        // Descuentos por Préstamos del Periodo
        let deduccionCuotas = 0
        const cuotasAfectadas: any[] = []

        // Tomamos 1 cuota por préstamo activo para el mes en curso (o semana)
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
                periodo,
                sueldoProporcional,
                horasNormales,
                montoHorasNormales: montoHsNorm,
                horasExtras,
                montoHorasExtras: montoHsExtra,
                horasFeriado,
                montoHorasFeriado: montoHsFeriado,
                descuentosPrestamos: deduccionCuotas,
                totalNeto: neto
            }
        })

        // Marcar las cuotas como pagadas y vincularlas a la liquidación
        for (const cuotaId of cuotasAfectadas) {
            await prisma.cuotaPrestamo.update({
                where: { id: cuotaId },
                data: {
                    estado: 'pagada',
                    fechaPago: new Date(),
                    liquidacionId: liquidacion.id
                }
            })
            // Podríamos revisar aquí si ya no quedan más cuotas pendientes y marcar el préstamo como 'pagado'
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
