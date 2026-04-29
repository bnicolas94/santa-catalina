import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const desdeStr = searchParams.get('desde')
        const hastaStr = searchParams.get('hasta')
        const empleadoId = searchParams.get('empleadoId')

        const ahora = new Date()
        const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
        
        const desde = desdeStr ? new Date(desdeStr) : new Date(ahora.getFullYear(), ahora.getMonth() - 3, 1)
        const hasta = hastaStr ? new Date(hastaStr) : new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59)

        // Lista de empleados activos para el selector
        const empleadosActivos = await prisma.empleado.findMany({
            where: { activo: true },
            select: { id: true, nombre: true, apellido: true },
            orderBy: [{ nombre: 'asc' }]
        })

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
                },
                items: {
                    include: {
                        concepto: true
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

        // Extraer todos los conceptos únicos del periodo para el filtro
        const conceptosUnicos = new Set<string>()
        liquidaciones.forEach(l => {
            l.items.forEach(item => {
                conceptosUnicos.add(item.concepto.nombre)
            })
        })

        // Detalle para la planilla
        const detallePlanilla = liquidaciones.map(l => ({
            id: l.id,
            empleado: `${l.empleado?.nombre} ${l.empleado?.apellido || ''}`,
            periodo: l.periodo,
            fecha: l.fechaGeneracion,
            hsExtras: l.horasExtras || 0,
            montoExtras: l.montoHorasExtras || 0,
            ingresos: l.totalNeto + (l.descuentosPrestamos || 0),
            descuentos: l.descuentosPrestamos || 0,
            neto: l.totalNeto,
            conceptos: l.items.map(item => ({
                nombre: item.concepto.nombre,
                monto: item.montoCalculado,
                tipo: item.concepto.tipo
            }))
        }))

        // 5. Préstamos Activos (Agrupados por empleado)
        const prestamosActivos = await prisma.prestamoEmpleado.findMany({
            where: {
                estado: 'activo'
            },
            include: {
                empleado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true
                    }
                },
                cuotas: true
            }
        })

        const agrupadosPorEmpleado: Record<string, any> = {}

        prestamosActivos.forEach(p => {
            const empId = p.empleadoId
            if (!agrupadosPorEmpleado[empId]) {
                agrupadosPorEmpleado[empId] = {
                    id: empId,
                    empleado: `${p.empleado.nombre} ${p.empleado.apellido || ''}`,
                    montoTotal: 0,
                    pagado: 0,
                    saldo: 0,
                    cuotasPagadas: 0,
                    cuotasTotales: 0,
                    prestamosActivos: 0,
                    listaPrestamos: []
                }
            }

            const pagadoEstePrestamo = p.cuotas
                .filter(c => c.estado === 'pagada')
                .reduce((acc, c) => acc + c.monto, 0)
            
            const cuotasPagadasEste = p.cuotas.filter(c => c.estado === 'pagada').length

            agrupadosPorEmpleado[empId].montoTotal += p.montoTotal
            agrupadosPorEmpleado[empId].pagado += pagadoEstePrestamo
            agrupadosPorEmpleado[empId].saldo += (p.montoTotal - pagadoEstePrestamo)
            agrupadosPorEmpleado[empId].cuotasPagadas += cuotasPagadasEste
            agrupadosPorEmpleado[empId].cuotasTotales += p.cantidadCuotas
            agrupadosPorEmpleado[empId].prestamosActivos++
            
            agrupadosPorEmpleado[empId].listaPrestamos.push({
                id: p.id,
                montoTotal: p.montoTotal,
                pagado: pagadoEstePrestamo,
                saldo: p.montoTotal - pagadoEstePrestamo,
                cuotas: `${cuotasPagadasEste}/${p.cantidadCuotas}`,
                fecha: p.fechaSolicitud,
                observaciones: p.observaciones,
                progreso: (pagadoEstePrestamo / p.montoTotal) * 100
            })
        })

        const resumenPrestamos = Object.values(agrupadosPorEmpleado)
            .map(p => ({
                ...p,
                cuotas: `${p.cuotasPagadas}/${p.cuotasTotales} (${p.prestamosActivos} p.)`,
                progreso: (p.pagado / p.montoTotal) * 100
            }))
            .filter(p => p.saldo > 0)
            .sort((a, b) => b.saldo - a.saldo)

        const totalDeudaActiva = resumenPrestamos.reduce((acc, p) => acc + p.saldo, 0)

        // 6. Datos Históricos por Empleado (si se filtra)
        let historico = null
        if (empleadoId) {
            const empleadoInfo = await prisma.empleado.findUnique({
                where: { id: empleadoId },
                select: { id: true, nombre: true, apellido: true, fechaIngreso: true, rol: true, activo: true }
            })

            // Todas las liquidaciones del empleado (sin filtro de fecha)
            const todasLiquidaciones = await prisma.liquidacionSueldo.findMany({
                where: { empleadoId, estado: { not: 'anulado' } },
                orderBy: { fechaGeneracion: 'desc' },
                include: {
                    items: { include: { concepto: true } }
                }
            })

            // Analizar ausencias desde el desglose de cada liquidación
            const historialSemanas = todasLiquidaciones.map(liq => {
                const desglose = (liq.desglose as any[]) || []
                
                // Días laborales: Lun-Sáb (excluir Domingo), menos 1 día de franco/descanso
                const diasLunASab = desglose.filter(d => d.diaSemana !== 'Domingo')
                const DIAS_FRANCO = 1
                const diasLaborales = diasLunASab.length - DIAS_FRANCO
                const diasTrabajados = diasLunASab.filter(d => d.horasTrabajadas > 0).length
                const diasJustificados = diasLunASab.filter(d => d.horasTrabajadas === 0 && d.esJustificado).length
                const diasSinFichar = diasLunASab.filter(d => d.horasTrabajadas === 0 && !d.esJustificado).length
                const diasAusentes = Math.max(0, diasSinFichar - DIAS_FRANCO)
                const hsExtras = desglose.reduce((acc: number, d: any) => acc + (d.horasExtras || 0), 0)
                const hsTotales = desglose.reduce((acc: number, d: any) => acc + (d.horasTrabajadas || 0), 0)

                return {
                    id: liq.id,
                    periodo: liq.periodo,
                    fecha: liq.fechaGeneracion,
                    tipo: liq.tipo,
                    diasLaborales,
                    diasTrabajados,
                    diasJustificados,
                    diasAusentes,
                    horasTotales: parseFloat(hsTotales.toFixed(2)),
                    hsExtras: parseFloat(hsExtras.toFixed(2)),
                    sueldoBase: liq.sueldoProporcional,
                    montoExtras: liq.montoHorasExtras,
                    montoFeriado: liq.montoHorasFeriado,
                    descuentos: liq.descuentosPrestamos,
                    neto: liq.totalNeto,
                    ajusteHsExtras: liq.ajusteHorasExtras,
                    desglose,
                    conceptos: liq.items.map(item => ({
                        nombre: item.concepto.nombre,
                        monto: item.montoCalculado,
                        tipo: item.concepto.tipo
                    }))
                }
            })

            // KPIs acumulados
            const totalNetoHistorico = todasLiquidaciones.reduce((acc, l) => acc + l.totalNeto, 0)
            const totalHsExtrasHistorico = todasLiquidaciones.reduce((acc, l) => acc + (l.horasExtras || 0), 0)
            const totalDescuentosHistorico = todasLiquidaciones.reduce((acc, l) => acc + (l.descuentosPrestamos || 0), 0)
            const totalDiasAusentes = historialSemanas.reduce((acc, s) => acc + s.diasAusentes, 0)
            const totalDiasTrabajados = historialSemanas.reduce((acc, s) => acc + s.diasTrabajados, 0)
            const totalDiasJustificados = historialSemanas.reduce((acc, s) => acc + s.diasJustificados, 0)

            // Préstamos del empleado
            const prestamosEmpleado = await prisma.prestamoEmpleado.findMany({
                where: { empleadoId },
                include: { cuotas: true },
                orderBy: { fechaSolicitud: 'desc' }
            })

            const deudaEmpleado = prestamosEmpleado
                .filter(p => p.estado === 'activo')
                .reduce((acc, p) => {
                    const pagado = p.cuotas.filter(c => c.estado === 'pagada').reduce((a, c) => a + c.monto, 0)
                    return acc + (p.montoTotal - pagado)
                }, 0)

            historico = {
                empleado: empleadoInfo,
                kpis: {
                    totalNeto: totalNetoHistorico,
                    totalHsExtras: parseFloat(totalHsExtrasHistorico.toFixed(2)),
                    totalDescuentos: totalDescuentosHistorico,
                    totalDiasTrabajados,
                    totalDiasAusentes,
                    totalDiasJustificados,
                    cantidadLiquidaciones: todasLiquidaciones.length,
                    promedioNetoPorLiquidacion: todasLiquidaciones.length > 0 ? Math.round(totalNetoHistorico / todasLiquidaciones.length) : 0,
                    deudaPendiente: deudaEmpleado
                },
                semanas: historialSemanas
            }
        }

        return NextResponse.json({
            empleados: empleadosActivos.map(e => ({ id: e.id, nombre: `${e.nombre} ${e.apellido || ''}`.trim() })),
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
                detalle: detallePlanilla,
                conceptos: Array.from(conceptosUnicos).sort()
            },
            prestamos: {
                totalDeuda: totalDeudaActiva,
                detalle: resumenPrestamos
            },
            historico
        })

    } catch (error: any) {
        console.error('Error en API Reportes RRHH:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
