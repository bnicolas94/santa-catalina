import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { periodoAnalyticsValido, periodoMesActual } from '@/lib/analytics/fechas'
import { fechaClaveRRHH, rangoDiasRRHH } from '@/lib/rrhh/fechas'
import { seleccionarInasistenciaPreferida } from '@/lib/rrhh/inasistencias'
import { calcularAusentismoRRHH, calcularPuntualidadRRHH } from '@/lib/analytics/metricas-rrhh'
import { agruparLiquidacionesPorTipo, etiquetaTipoLiquidacion, normalizarTipoLiquidacion } from '@/lib/analytics/liquidaciones'
import { fechasDeRangoVacaciones, rangoVacacionesDesdeDesglose } from '@/lib/payroll/vacaciones'
import type { Sancion } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface PrestamoAgrupado {
    id: string
    empleado: string
    montoTotal: number
    pagado: number
    saldo: number
    cuotasPagadas: number
    cuotasTotales: number
    prestamosActivos: number
    listaPrestamos: Array<{
        id: string
        montoTotal: number
        pagado: number
        saldo: number
        cuotas: string
        fecha: Date
        observaciones: string | null
        progreso: number
    }>
}

interface DesgloseHistorico {
    diaSemana?: string
    horasTrabajadas?: number
    horasExtras?: number
    esJustificado?: boolean
    [campo: string]: unknown
}

interface DiaAsistenciaReporte {
    fecha: string
    diaSemana: string
    esFeriado: boolean
    nombreFeriado: string | null
    esFranco: boolean
    status: string
    horasTrabajadas: number
    entrada: string | null
    salida: string | null
    inasistenciaId: string | null
    motivoInasistencia: string | null
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const desdeStr = searchParams.get('desde')
        const hastaStr = searchParams.get('hasta')
        const empleadoId = searchParams.get('empleadoId')

        const ahora = new Date()
        const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1)

        const periodoPredeterminado = periodoMesActual(ahora)
        const desdeCivil = desdeStr || periodoPredeterminado.desde
        const hastaCivil = hastaStr || periodoPredeterminado.hasta
        if (!periodoAnalyticsValido(desdeCivil, hastaCivil)) {
            return NextResponse.json({ error: 'El período solicitado es inválido.' }, { status: 400 })
        }
        const rango = rangoDiasRRHH(desdeCivil, hastaCivil)
        const diasSolicitados = Math.ceil((rango.lt.getTime() - rango.gte.getTime()) / 86_400_000)
        if (diasSolicitados > 366) {
            return NextResponse.json({ error: 'El período no puede superar 366 días.' }, { status: 400 })
        }
        const desde = rango.gte
        const hasta = new Date(rango.lt.getTime() - 1)

        // Lista de empleados activos para el selector
        const empleadosActivos = await prisma.empleado.findMany({
            where: { activo: true },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                fechaIngreso: true,
                jornal: true,
                sueldoBaseMensual: true,
                cicloPago: true,
                diasTrabajoSemana: true,
                rolRel: { select: { jornal: true, cicloPago: true } },
            },
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
        const [fichadas, inasistenciasPeriodo, feriadosPeriodo, vacacionesHistoricas] = await Promise.all([
            prisma.fichadaEmpleado.findMany({
                where: { fechaHora: { gte: desde, lte: hasta } },
                include: {
                    empleado: {
                        select: {
                            id: true,
                            nombre: true,
                            apellido: true,
                            horarioEntrada: true,
                            turno: { select: { horaInicio: true, toleranciaMinutos: true } },
                        }
                    }
                }
            }),
            prisma.inasistencia.findMany({
                where: { fecha: { gte: desde, lte: hasta } },
                select: { empleadoId: true, fecha: true, tipo: true },
            }),
            prisma.feriado.findMany({
                where: { fecha: { gte: desde, lte: hasta } },
                select: { fecha: true },
            }),
            prisma.liquidacionSueldo.findMany({
                where: { tipo: 'VACACIONES', estado: { not: 'anulado' } },
                select: { empleadoId: true, desglose: true },
            }),
        ])

        const totalFichadas = fichadas.length

        const puntualidad = calcularPuntualidadRRHH(fichadas
            .filter(fichada => fichada.tipo === 'entrada')
            .map(fichada => ({
                empleadoId: fichada.empleadoId,
                empleadoNombre: `${fichada.empleado.nombre} ${fichada.empleado.apellido || ''}`.trim(),
                fechaHora: fichada.fechaHora,
                horaObjetivo: fichada.empleado.turno?.horaInicio || fichada.empleado.horarioEntrada,
                toleranciaMinutos: fichada.empleado.turno?.toleranciaMinutos,
            })))

        const vacacionesLegacy = vacacionesHistoricas.flatMap(liquidacion => {
            const rango = rangoVacacionesDesdeDesglose(liquidacion.desglose)
            if (!rango) return []
            return fechasDeRangoVacaciones(rango.desde, rango.hasta)
                .filter(fecha => fecha >= desdeCivil && fecha <= hastaCivil)
                .map(fecha => ({ empleadoId: liquidacion.empleadoId, fecha, tipo: 'VACACIONES' }))
        })

        const inasistenciasPeriodoPorDia = new Map<string, typeof inasistenciasPeriodo[number]>()
        inasistenciasPeriodo.forEach(inasistencia => {
            const clave = `${inasistencia.empleadoId}:${fechaClaveRRHH(inasistencia.fecha)}`
            const actual = inasistenciasPeriodoPorDia.get(clave)
            const seleccionada = actual
                ? seleccionarInasistenciaPreferida([actual, inasistencia])
                : inasistencia
            if (seleccionada) inasistenciasPeriodoPorDia.set(clave, seleccionada)
        })

        const ausentismo = calcularAusentismoRRHH({
            empleados: empleadosActivos,
            ausencias: [
                ...inasistenciasPeriodoPorDia.values(),
                ...vacacionesLegacy,
                ...fichadas.filter(fichada => fichada.tipo === 'ausencia').map(fichada => ({
                    empleadoId: fichada.empleadoId,
                    fecha: fichada.fechaHora,
                    tipo: 'LICENCIA',
                })),
            ],
            feriados: feriadosPeriodo.map(feriado => feriado.fecha),
            desde: desdeCivil,
            hasta: hastaCivil,
        })

        const {
            tardanzas,
            detalleTardanzas,
            indicePuntualidad,
            rankingMejores,
            rankingPeores,
            porcentajeTardanzas,
        } = puntualidad
        const { ausencias, porcentajeAusentismo, costoAusentismo, jornadasEsperadas } = ausentismo

        // Sanciones del período
        let sancionesCount = 0
        try {
            sancionesCount = await prisma.sancion.count({
                where: { fecha: { gte: desde, lte: hasta } }
            })
        } catch { /* table may not exist yet */ }

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

        // Los indicadores operativos representan nómina habitual. SAC,
        // vacaciones y liquidaciones finales se informan aparte para evitar
        // sumar conceptos de distinta naturaleza.
        const liquidacionesNomina = liquidaciones.filter(liquidacion => normalizarTipoLiquidacion(liquidacion.tipo, liquidacion.periodo) === 'NORMAL')
        const totalGeneralLiquidado = liquidaciones.reduce((acc, liquidacion) => acc + liquidacion.totalNeto, 0)
        const porTipoLiquidacion = agruparLiquidacionesPorTipo(liquidaciones)
        const totalMasaSalarial = liquidacionesNomina.reduce((acc, l) => acc + l.totalNeto, 0)
        const totalHorasExtras = liquidacionesNomina.reduce((acc, l) => acc + (l.horasExtras || 0), 0)
        const totalMontoHorasExtras = liquidacionesNomina.reduce((acc, l) => acc + (l.montoHorasExtras || 0), 0)
        const totalHorasNormales = liquidacionesNomina.reduce((acc, l) => acc + (l.horasNormales || 0), 0)
        const totalMontoFeriados = liquidacionesNomina.reduce((acc, l) => acc + (l.montoHorasFeriado || 0), 0)
        const totalHorasFeriado = liquidacionesNomina.reduce((acc, l) => acc + (l.horasFeriado || 0), 0)
        const totalSueldoBase = liquidacionesNomina.reduce((acc, l) => acc + (l.sueldoProporcional || 0), 0)
        const totalDescuentosPrestamos = liquidacionesNomina.reduce((acc, l) => acc + (l.descuentosPrestamos || 0), 0)
        
        // KPIs de inversión
        const inversionBruta = totalSueldoBase + totalMontoHorasExtras + totalMontoFeriados
        const ratioExtrasBase = inversionBruta > 0 ? (totalMontoHorasExtras / inversionBruta) * 100 : 0
        const costoHoraEfectiva = totalHorasNormales > 0 ? totalMasaSalarial / totalHorasNormales : 0
        const costoPromedioEmpleado = activos > 0 ? totalMasaSalarial / activos : 0

        // Tendencia semanal (agrupar liquidaciones por periodo)
        const tendenciaPorPeriodo: Record<string, { periodo: string, totalNeto: number, montoExtras: number, montoFeriados: number, count: number }> = {}
        liquidacionesNomina.forEach(l => {
            const periodo = l.periodo
            if (!tendenciaPorPeriodo[periodo]) {
                tendenciaPorPeriodo[periodo] = { periodo, totalNeto: 0, montoExtras: 0, montoFeriados: 0, count: 0 }
            }
            tendenciaPorPeriodo[periodo].totalNeto += l.totalNeto
            tendenciaPorPeriodo[periodo].montoExtras += (l.montoHorasExtras || 0)
            tendenciaPorPeriodo[periodo].montoFeriados += (l.montoHorasFeriado || 0)
            tendenciaPorPeriodo[periodo].count++
        })
        const tendenciaSemanal = Object.values(tendenciaPorPeriodo).sort((a, b) => a.periodo.localeCompare(b.periodo))

        // Agrupar masa salarial por área
        const masaPorArea: Record<string, number> = {}
        liquidacionesNomina.forEach(l => {
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
            tipo: normalizarTipoLiquidacion(l.tipo, l.periodo),
            tipoLabel: etiquetaTipoLiquidacion(l.tipo, l.periodo),
            periodo: l.periodo,
            fecha: l.fechaGeneracion,
            hsExtras: l.horasExtras || 0,
            montoExtras: l.montoHorasExtras || 0,
            hsFeriado: l.horasFeriado || 0,
            montoFeriado: l.montoHorasFeriado || 0,
            sueldoBase: l.sueldoProporcional || 0,
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

        const agrupadosPorEmpleado: Record<string, PrestamoAgrupado> = {}

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

        // KPIs de préstamos
        const porcentajeNominaPrestamos = totalMasaSalarial > 0 ? (totalDescuentosPrestamos / totalMasaSalarial) * 100 : 0
        const promedioDescuentoSemanal = tendenciaSemanal.length > 0 
            ? totalDescuentosPrestamos / tendenciaSemanal.length 
            : 0
        const semanasRecupero = promedioDescuentoSemanal > 0 ? Math.ceil(totalDeudaActiva / promedioDescuentoSemanal) : 0

        // 6. Estructura - Antigüedad
        const antiguedades = empleadosActivos
            .filter(e => e.fechaIngreso)
            .map(e => {
                const diff = ahora.getTime() - new Date(e.fechaIngreso!).getTime()
                return diff / (1000 * 60 * 60 * 24 * 30) // meses
            })
        const antiguedadPromedio = antiguedades.length > 0 
            ? parseFloat((antiguedades.reduce((a, b) => a + b, 0) / antiguedades.length).toFixed(1)) 
            : 0
        const antiguedadMaxima = antiguedades.length > 0 ? parseFloat(Math.max(...antiguedades).toFixed(1)) : 0
        const antiguedadMinima = antiguedades.length > 0 ? parseFloat(Math.min(...antiguedades).toFixed(1)) : 0

        // 7. Datos Históricos por Empleado (si se filtra)
        let historico = null
        if (empleadoId) {
            const empleadoInfo = await prisma.empleado.findUnique({
                where: { id: empleadoId },
                select: { id: true, nombre: true, apellido: true, dni: true, fechaIngreso: true, rol: true, activo: true, jornal: true, diasTrabajoSemana: true }
            })

            // Todas las liquidaciones del empleado filtradas por fecha
            const todasLiquidaciones = await prisma.liquidacionSueldo.findMany({
                where: { 
                    empleadoId, 
                    estado: { not: 'anulado' },
                    fechaGeneracion: { gte: desde, lte: hasta }
                },
                orderBy: { fechaGeneracion: 'desc' },
                include: {
                    items: { include: { concepto: true } }
                }
            })

            // Analizar ausencias desde el desglose de cada liquidación
            const historialSemanas = todasLiquidaciones.map(liq => {
                const desgloseRaw = liq.desglose || []
                const desglose = Array.isArray(desgloseRaw) ? (desgloseRaw as DesgloseHistorico[]) : []
                
                // Días laborales: Lun-Sáb (excluir Domingo)
                const diasLaborales = desglose.filter(d => d.diaSemana !== 'Domingo')
                const diasTrabajados = diasLaborales.filter(d => (d.horasTrabajadas ?? 0) > 0).length
                const diasJustificados = diasLaborales.filter(d => (d.horasTrabajadas ?? 0) === 0 && d.esJustificado).length
                const diasAusentes = diasLaborales.filter(d => (d.horasTrabajadas ?? 0) === 0 && !d.esJustificado).length
                const hsExtras = desglose.reduce((acc, d) => acc + (d.horasExtras || 0), 0)
                const hsTotales = desglose.reduce((acc, d) => acc + (d.horasTrabajadas || 0), 0)

                return {
                    id: liq.id,
                    periodo: liq.periodo,
                    fecha: liq.fechaGeneracion,
                    tipo: liq.tipo,
                    diasLaborales: diasLaborales.length,
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
            const totalMontoHsExtrasHistorico = todasLiquidaciones.reduce((acc, l) => acc + (l.montoHorasExtras || 0), 0)
            const totalDescuentosHistorico = todasLiquidaciones.reduce((acc, l) => acc + (l.descuentosPrestamos || 0), 0)
            const totalDiasAusentes = historialSemanas.reduce((acc, s) => acc + s.diasAusentes, 0)
            const totalDiasTrabajados = historialSemanas.reduce((acc, s) => acc + s.diasTrabajados, 0)
            const totalDiasJustificados = historialSemanas.reduce((acc, s) => acc + s.diasJustificados, 0)

            // Puntualidad individual
            const puntualidadIndividual = indicePuntualidad.find(indice => indice.empleadoId === empleadoId)?.porcentaje ?? 100

            // Sanciones individuales
            let sancionesIndividuales = 0
            let listaSanciones: Sancion[] = []
            try {
                const sancionesFetched = await prisma.sancion.findMany({
                    where: { empleadoId },
                    orderBy: { fecha: 'desc' },
                    include: { empleado: true }
                })
                sancionesIndividuales = sancionesFetched.length
                listaSanciones = sancionesFetched
            } catch { /* table may not exist */ }

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

            // Generar desglose de asistencia diaria para el período seleccionado
            const diasAsistencia: DiaAsistenciaReporte[] = []
            
            const inasistenciasRango = await prisma.inasistencia.findMany({
                where: {
                    empleadoId,
                    fecha: { gte: desde, lte: hasta }
                }
            })

            const fichadasRango = await prisma.fichadaEmpleado.findMany({
                where: {
                    empleadoId,
                    fechaHora: { gte: desde, lte: hasta }
                },
                orderBy: { fechaHora: 'asc' }
            })

            const feriadosRango = await prisma.feriado.findMany({
                where: {
                    fecha: { gte: desde, lte: hasta }
                }
            })

            const feriadosMap = new Map(feriadosRango.map(f => [
                f.fecha.toISOString().split('T')[0],
                f.nombre
            ]))

            const fichadasPorDia: Record<string, typeof fichadasRango> = {}
            fichadasRango.forEach(f => {
                const localDate = new Date(f.fechaHora.getTime() - f.fechaHora.getTimezoneOffset() * 60000)
                const dateStr = localDate.toISOString().split('T')[0]
                if (!fichadasPorDia[dateStr]) {
                    fichadasPorDia[dateStr] = []
                }
                fichadasPorDia[dateStr].push(f)
            })

            const inasistenciasPorDia = new Map<string, typeof inasistenciasRango[number]>()
            inasistenciasRango.forEach(inasistencia => {
                const clave = fechaClaveRRHH(inasistencia.fecha)
                const actual = inasistenciasPorDia.get(clave)
                const seleccionada = actual
                    ? seleccionarInasistenciaPreferida([actual, inasistencia])
                    : inasistencia
                if (seleccionada) inasistenciasPorDia.set(clave, seleccionada)
            })
            const fechasVacacionesEmpleado = new Set(
                vacacionesLegacy
                    .filter(vacacion => vacacion.empleadoId === empleadoId)
                    .map(vacacion => vacacion.fecha)
            )

            const current = new Date(desde)
            const end = new Date(hasta)
            const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

            while (current <= end) {
                const year = current.getFullYear()
                const month = String(current.getMonth() + 1).padStart(2, '0')
                const day = String(current.getDate()).padStart(2, '0')
                const fechaStr = `${year}-${month}-${day}`
                const dayOfWeekNum = current.getDay()
                const diaSemana = nombresDias[dayOfWeekNum]

                const esFeriado = feriadosMap.has(fechaStr)
                const nombreFeriado = feriadosMap.get(fechaStr) || null

                const diasTrabajo = (empleadoInfo?.diasTrabajoSemana || 'Lunes a Viernes').toLowerCase()
                let esFranco = false
                if (dayOfWeekNum === 0 && !diasTrabajo.includes('domingo')) esFranco = true
                if (dayOfWeekNum === 6 && diasTrabajo.includes('lunes a viernes')) esFranco = true

                const inasistencia = inasistenciasPorDia.get(fechaStr)
                const esVacaciones = inasistencia?.tipo === 'VACACIONES' || fechasVacacionesEmpleado.has(fechaStr)
                const marcas = fichadasPorDia[fechaStr] || []
                const primerEntrada = marcas.find(m => m.tipo === 'entrada')?.fechaHora || null
                const ultimaSalida = [...marcas].reverse().find(m => m.tipo === 'salida')?.fechaHora || null

                let horasTrabajadas = 0
                if (primerEntrada && ultimaSalida && new Date(ultimaSalida) > new Date(primerEntrada)) {
                    const diffMs = new Date(ultimaSalida).getTime() - new Date(primerEntrada).getTime()
                    horasTrabajadas = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
                }

                let status = 'TRABAJO'
                if (esVacaciones) {
                    status = 'VACACIONES'
                } else if (inasistencia) {
                    if (inasistencia.tipo === 'VACACIONES') {
                        status = 'VACACIONES'
                    } else if (inasistencia.motivo === 'Enfermedad') {
                        status = 'ENFERMEDAD'
                    } else if (inasistencia.motivo === 'Franco' || inasistencia.tipo === 'FRANCO') {
                        status = 'FRANCO'
                    } else if (inasistencia.motivo === 'Feriado' || inasistencia.tipo === 'FERIADO') {
                        status = 'FERIADO'
                    } else if (inasistencia.motivo === 'Trabajó' || inasistencia.tipo === 'TRABAJO') {
                        status = 'TRABAJO'
                    } else if (inasistencia.tipo === 'INJUSTIFICADA') {
                        status = 'SIN_AVISO'
                    } else {
                        status = 'CON_AVISO'
                    }
                } else if (marcas.length === 0) {
                    if (esFeriado) {
                        status = 'FERIADO'
                    } else if (esFranco) {
                        status = 'FRANCO'
                    } else {
                        status = 'TRABAJO' // Hábil por defecto sin inasistencia ni fichadas
                    }
                }

                diasAsistencia.push({
                    fecha: fechaStr,
                    diaSemana,
                    esFeriado,
                    nombreFeriado,
                    esFranco,
                    status,
                    horasTrabajadas,
                    entrada: primerEntrada ? new Date(primerEntrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null,
                    salida: ultimaSalida ? new Date(ultimaSalida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : null,
                    inasistenciaId: inasistencia?.id || null,
                    motivoInasistencia: inasistencia?.motivo || null
                })

                current.setDate(current.getDate() + 1)
            }

            historico = {
                empleado: empleadoInfo,
                kpis: {
                    totalNeto: totalNetoHistorico,
                    totalHsExtras: parseFloat(totalHsExtrasHistorico.toFixed(2)),
                    totalMontoHsExtras: totalMontoHsExtrasHistorico,
                    totalDescuentos: totalDescuentosHistorico,
                    totalDiasTrabajados,
                    totalDiasAusentes,
                    totalDiasJustificados,
                    cantidadLiquidaciones: todasLiquidaciones.length,
                    promedioNetoPorLiquidacion: todasLiquidaciones.length > 0 ? Math.round(totalNetoHistorico / todasLiquidaciones.length) : 0,
                    deudaPendiente: deudaEmpleado,
                    puntualidad: puntualidadIndividual,
                    sanciones: sancionesIndividuales
                },
                semanas: historialSemanas,
                asistenciaDiaria: diasAsistencia.reverse(), // Mostrar el más reciente primero
                listaSanciones
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
                totalEntradas: puntualidad.totalEntradas,
                jornadasEsperadas,
                tardanzas,
                detalleTardanzas: detalleTardanzas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
                ausencias,
                porcentajeTardanzas,
                porcentajeAusentismo,
                indicePuntualidad,
                rankingMejores,
                rankingPeores,
                costoAusentismo: parseFloat(costoAusentismo.toFixed(0)),
                sancionesCount
            },
            nomina: {
                total: totalMasaSalarial,
                totalGeneral: totalGeneralLiquidado,
                porTipo: porTipoLiquidacion,
                totalHsExtras: totalHorasExtras,
                totalMontoHsExtras: totalMontoHorasExtras,
                totalHorasFeriado,
                totalMontoFeriados: totalMontoFeriados,
                totalSueldoBase,
                porArea: masaPorAreaConNombre,
                detalle: detallePlanilla,
                conceptos: Array.from(conceptosUnicos).sort()
            },
            inversion: {
                ratioExtrasBase: parseFloat(ratioExtrasBase.toFixed(1)),
                costoHoraEfectiva: parseFloat(costoHoraEfectiva.toFixed(0)),
                costoPromedioEmpleado: parseFloat(costoPromedioEmpleado.toFixed(0)),
                tendenciaSemanal
            },
            prestamos: {
                totalDeuda: totalDeudaActiva,
                descuentosPeriodo: totalDescuentosPrestamos,
                porcentajeNomina: parseFloat(porcentajeNominaPrestamos.toFixed(1)),
                semanasRecupero,
                detalle: resumenPrestamos
            },
            estructura: {
                antiguedadPromedio,
                antiguedadMaxima,
                antiguedadMinima
            },
            historico
        })

    } catch (error: unknown) {
        console.error('Error en API Reportes RRHH:', error)
        return NextResponse.json({ error: 'No se pudieron generar las analíticas de RR. HH.' }, { status: 500 })
    }
}
