import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const desdeStr = searchParams.get('desde')
        const hastaStr = searchParams.get('hasta')

        const ahora = new Date()
        const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        
        const desde = desdeStr ? new Date(desdeStr) : new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1)
        const hasta = hastaStr ? new Date(hastaStr) : new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)

        // 1. Estadísticas Generales
        const [totalEmpleados, activos, nuevosMes, bajasMes] = await Promise.all([
            prisma.empleado.count(),
            prisma.empleado.count({ where: { activo: true } }),
            prisma.empleado.count({ 
                where: { 
                    fechaIngreso: { gte: inicioMesActual },
                    activo: true
                } 
            }),
            prisma.empleado.count({ 
                where: { 
                    activo: false,
                    updatedAt: { gte: inicioMesActual }
                } 
            })
        ])

        // 2. Distribución por Área y Puesto
        const [porArea, porPuesto] = await Promise.all([
            prisma.area.findMany({
                where: { activo: true },
                include: { _count: { select: { empleados: { where: { activo: true } } } } }
            }),
            prisma.puesto.findMany({
                where: { activo: true },
                include: { _count: { select: { empleados: { where: { activo: true } } } } }
            })
        ])

        // 3. Ausentismo y Tardanzas (Rango seleccionado)
        const fichadas = await prisma.fichadaEmpleado.findMany({
            where: {
                fechaHora: { gte: desde, lte: hasta }
            },
            include: {
                empleado: {
                    select: {
                        horarioEntrada: true,
                        turno: {
                            select: {
                                horaInicio: true,
                                toleranciaMinutos: true
                            }
                        }
                    }
                }
            }
        })

        const totalFichadas = fichadas.length
        
        // Cálculo de tardanzas dinámico
        let tardanzas = 0
        fichadas.forEach(f => {
            if (f.tipo !== 'entrada') return
            
            const horaObjetivo = f.empleado?.turno?.horaInicio || f.empleado?.horarioEntrada
            if (!horaObjetivo) return

            const tolerancia = f.empleado?.turno?.toleranciaMinutos ?? 10
            const [h, m] = horaObjetivo.split(':').map(Number)
            
            const limite = new Date(f.fechaHora)
            limite.setHours(h, m + tolerancia, 0, 0)

            if (f.fechaHora > limite) {
                tardanzas++
            }
        })

        const ausencias = fichadas.filter(f => f.tipo === 'ausencia').length

        // 4. Masa Salarial (Liquidaciones en el periodo)
        const liquidaciones = await prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: { gte: desde, lte: hasta },
                estado: { not: 'anulado' }
            },
            include: {
                empleado: {
                    select: {
                        nombre: true,
                        apellido: true,
                        areaId: true
                    }
                }
            },
            orderBy: { fechaGeneracion: 'desc' }
        })

        const totalMasaSalarial = liquidaciones.reduce((acc, l) => acc + l.totalNeto, 0)
        const totalHorasExtras = liquidaciones.reduce((acc, l) => acc + (l.horasExtras || 0), 0)
        const totalMontoHorasExtras = liquidaciones.reduce((acc, l) => acc + (l.montoHorasExtras || 0), 0)
        
        // Agrupar masa salarial por área
        const masaPorArea: Record<string, number> = {}
        liquidaciones.forEach(l => {
            const areaId = l.empleado?.areaId || 'Sin Área'
            masaPorArea[areaId] = (masaPorArea[areaId] || 0) + l.totalNeto
        })

        // Obtener nombres de áreas para el mapeo
        const areasIds = Object.keys(masaPorArea)
        const areasData = await prisma.area.findMany({ where: { id: { in: areasIds } } })
        const masaPorAreaConNombre = Object.entries(masaPorArea).map(([id, monto]) => ({
            nombre: areasData.find(a => a.id === id)?.nombre || 'Sin Área',
            monto
        }))

        // Detalle para la planilla
        const detallePlanilla = liquidaciones.map(l => ({
            id: l.id,
            empleado: `${l.empleado?.nombre} ${l.empleado?.apellido || ''}`,
            periodo: l.periodo,
            fecha: l.fechaGeneracion,
            hsExtras: l.horasExtras || 0,
            montoExtras: l.montoHorasExtras || 0,
            ingresos: l.totalNeto + (l.descuentosPrestamos || 0), // Aproximación
            descuentos: l.descuentosPrestamos || 0,
            neto: l.totalNeto
        }))

        return NextResponse.json({
            stats: {
                total: totalEmpleados,
                activos,
                nuevosMes,
                bajasMes,
                rotacion: totalEmpleados > 0 ? (bajasMes / totalEmpleados) * 100 : 0
            },
            distribucion: {
                area: porArea.map(a => ({ nombre: a.nombre, cantidad: a._count.empleados })),
                puesto: porPuesto.map(p => ({ nombre: p.nombre, cantidad: p._count.empleados }))
            },
            asistencia: {
                totalFichadas,
                tardanzas,
                ausencias,
                porcentajeTardanzas: totalFichadas > 0 ? (tardanzas / totalFichadas) * 100 : 0,
                porcentajeAusentismo: totalFichadas > 0 ? (ausencias / totalFichadas) * 100 : 0
            },
            nomina: {
                total: totalMasaSalarial,
                totalHsExtras: totalHorasExtras,
                totalMontoHsExtras: totalMontoHorasExtras,
                porArea: masaPorAreaConNombre,
                detalle: detallePlanilla
            }
        })

    } catch (error: any) {
        console.error('Error en API Reportes RRHH:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
