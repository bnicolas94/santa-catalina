import { prisma } from '@/lib/prisma'
import { getGlobalConfig } from './reportes'

/**
 * Extrae la fecha de INICIO del período trabajado desde el campo `periodo` de una liquidación.
 * Formatos soportados:
 *   - "Semana del 1/6/2026 al 7/6/2026"
 *   - "Express 08/06/2026 - 14/06/2026"
 *   - Cualquier string que contenga una fecha DD/MM/YYYY o D/M/YYYY
 *
 * Retorna la fecha de inicio del período trabajado, o null si no se pudo parsear.
 */
export function parsePeriodoStartDate(periodo: string): Date | null {
    if (!periodo) return null

    // Intentar extraer la primera fecha del string (formato D/M/YYYY o DD/MM/YYYY)
    const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/
    const match = periodo.match(dateRegex)
    if (match) {
        const day = parseInt(match[1])
        const month = parseInt(match[2]) - 1 // 0-indexed
        const year = parseInt(match[3])
        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) return date
    }
    return null
}

/**
 * Determina a qué mes pertenece una liquidación basándose en el período trabajado.
 * 
 * Regla de negocio: Una liquidación pertenece al mes donde INICIA el período trabajado.
 * Si el período empieza el 26/5, es gasto de Mayo.
 * Si el período empieza el 1/6, es gasto de Junio.
 * 
 * Si no se puede parsear el período, se usa la fechaGeneración como fallback,
 * pero SIN desplazamiento artificial de días.
 */
export function liquidacionBelongsToPeriod(
    liq: { periodo: string; fechaGeneracion: Date },
    periodStart: Date,
    periodEnd: Date
): boolean {
    const periodoStart = parsePeriodoStartDate(liq.periodo)
    const refDate = periodoStart || liq.fechaGeneracion

    return refDate >= periodStart && refDate <= periodEnd
}

/**
 * Obtiene un rango amplio para traer liquidaciones de la DB.
 * Traemos un margen generoso (todo el mes + 10 días antes y después)
 * y luego filtramos en memoria con liquidacionBelongsToPeriod.
 */
export function getLiquidacionFetchRange(periodStart: Date, periodEnd: Date) {
    const liqStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), -10, 0, 0, 0, 0)
    const liqEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 15, 23, 59, 59, 999)
    return { liqStart, liqEnd }
}

/**
 * Servicio de reportes de costos.
 * Analiza: costo por producto, margen bruto, evolución de precios de insumos, gastos operativos.
 */
export async function getCostosReport(
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string,
    incluirTodo = false
) {
    const startOfCurrent = new Date(desdeIso)
    const endOfCurrent = new Date(hastaIso)

    // Período anterior
    const diffMs = endOfCurrent.getTime() - startOfCurrent.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const endAnterior = new Date(startOfCurrent)
    endAnterior.setDate(endAnterior.getDate() - 1)
    endAnterior.setHours(23, 59, 59, 999)

    const startAnterior = new Date(endAnterior)
    startAnterior.setDate(startAnterior.getDate() - diffDays + 1)
    startAnterior.setHours(0, 0, 0, 0)

    const whereUbi = ubicacionId ? { ubicacionId } : {}

    // ── 1. Costo total de insumos comprados ──
    const [comprasActual, comprasAnterior] = await Promise.all([
        prisma.movimientoStock.aggregate({
            where: {
                tipo: 'entrada',
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...whereUbi
            },
            _sum: { costoTotal: true },
            _count: true
        }),
        prisma.movimientoStock.aggregate({
            where: {
                tipo: 'entrada',
                fecha: { gte: startAnterior, lte: endAnterior },
                ...whereUbi
            },
            _sum: { costoTotal: true },
            _count: true
        })
    ])

    const costoInsumosActual = comprasActual._sum.costoTotal || 0
    const costoInsumosAnterior = comprasAnterior._sum.costoTotal || 0

    // ── 1b. Egresos de Caja tildados para costos ──
    const conceptosCajaTildados: string[] = await getGlobalConfig('conceptos_caja_en_costos', [])
    let egresosCajaActual: any[] = []
    let egresosCajaAnterior: any[] = []

    if (conceptosCajaTildados.length > 0) {
        ;[egresosCajaActual, egresosCajaAnterior] = await Promise.all([
            prisma.movimientoCaja.findMany({
                where: {
                    tipo: 'egreso',
                    concepto: { in: conceptosCajaTildados },
                    gastoId: null,
                    fecha: { gte: startOfCurrent, lte: endOfCurrent }
                },
                orderBy: { fecha: 'desc' }
            }),
            prisma.movimientoCaja.findMany({
                where: {
                    tipo: 'egreso',
                    concepto: { in: conceptosCajaTildados },
                    gastoId: null,
                    fecha: { gte: startAnterior, lte: endAnterior }
                },
                orderBy: { fecha: 'desc' }
            })
        ])
    }

    const egresosCajaTotalActual = egresosCajaActual.reduce((acc, e) => acc + e.monto, 0)
    const egresosCajaTotalAnterior = egresosCajaAnterior.reduce((acc, e) => acc + e.monto, 0)

    // ── 1b. Ventas del período (para calcular margen real) ──
    const estadoVentas = incluirTodo
        ? { in: ['entregado', 'confirmado', 'en_camino', 'pendiente'] as string[] }
        : 'entregado' as any

    const [ventasActual, ventasAnterior] = await Promise.all([
        prisma.pedido.aggregate({
            where: {
                estado: estadoVentas,
                fechaEntrega: { gte: startOfCurrent, lte: endOfCurrent },
                ...(ubicacionId ? { ubicacionId } : {})
            },
            _sum: { totalImporte: true },
            _count: true
        }),
        prisma.pedido.aggregate({
            where: {
                estado: estadoVentas,
                fechaEntrega: { gte: startAnterior, lte: endAnterior },
                ...(ubicacionId ? { ubicacionId } : {})
            },
            _sum: { totalImporte: true },
            _count: true
        })
    ])

    const ventasTotalActual = ventasActual._sum.totalImporte || 0
    const ventasTotalAnterior = ventasAnterior._sum.totalImporte || 0

    // ── 2. Gastos operativos, Sueldos y Mantenimientos ──
    // IMPORTANTE: Excluir gastos que ya están contabilizados como compras de insumos
    // (los GastoOperativo que tienen un MovimientoStock vinculado)
    // Traer liquidaciones con rango amplio, luego filtrar por período trabajado
    const { liqStart: liqFetchStartActual, liqEnd: liqFetchEndActual } = getLiquidacionFetchRange(startOfCurrent, endOfCurrent)
    const { liqStart: liqFetchStartAnterior, liqEnd: liqFetchEndAnterior } = getLiquidacionFetchRange(startAnterior, endAnterior)

    const [gastos, liqsRaw, mants, gastosAnterior, liqsAnteriorRaw, mantsAnterior] = await Promise.all([
        // Gastos operativos actuales (excluyendo los vinculados a movimientos de stock)
        prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...(ubicacionId ? { ubicacionId } : {}),
                movimientosStock: { none: {} }
            },
            include: { categoria: true }
        }),
        // Liquidaciones: rango amplio, se filtra en memoria por período trabajado
        prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: { gte: liqFetchStartActual, lte: liqFetchEndActual },
                estado: incluirTodo ? { in: ['pagado', 'generado'] } : 'pagado'
            },
            include: { empleado: { select: { nombre: true, apellido: true } } }
        }),
        // Mantenimientos actuales
        prisma.mantenimientoVehiculo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent }
            },
            include: { vehiculo: { select: { patente: true, marca: true, modelo: true } } }
        }),
        // Período anterior detallado (para desglose de variación por categoría)
        prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startAnterior, lte: endAnterior },
                ...(ubicacionId ? { ubicacionId } : {}),
                movimientosStock: { none: {} }
            },
            include: { categoria: true }
        }),
        prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: { gte: liqFetchStartAnterior, lte: liqFetchEndAnterior },
                estado: incluirTodo ? { in: ['pagado', 'generado'] } : 'pagado'
            },
            include: { empleado: { select: { nombre: true, apellido: true } } }
        }),
        prisma.mantenimientoVehiculo.findMany({
            where: {
                fecha: { gte: startAnterior, lte: endAnterior }
            },
            include: { vehiculo: { select: { patente: true, marca: true, modelo: true } } }
        })
    ])

    // Filtrar liquidaciones en memoria según el período trabajado
    const liqs = liqsRaw.filter(l => liquidacionBelongsToPeriod(l, startOfCurrent, endOfCurrent))
    const liqsAnterior = liqsAnteriorRaw.filter(l => liquidacionBelongsToPeriod(l, startAnterior, endAnterior))

    const gastosTotalActualBase = gastos.reduce((acc, g) => acc + g.monto, 0)
    const liqsTotalActual = liqs.reduce((acc, l) => acc + l.totalNeto, 0)
    const mantsTotalActual = mants.reduce((acc, m) => acc + m.costo, 0)
    const gastosTotalActual = gastosTotalActualBase + liqsTotalActual + mantsTotalActual + egresosCajaTotalActual

    const gastosTotalAnteriorBase = gastosAnterior.reduce((acc: number, g: any) => acc + g.monto, 0)
    const liqsTotalAnterior = liqsAnterior.reduce((acc: number, l: any) => acc + l.totalNeto, 0)
    const mantsTotalAnterior = mantsAnterior.reduce((acc: number, m: any) => acc + m.costo, 0)
    const gastosTotalAnterior = gastosTotalAnteriorBase + liqsTotalAnterior + mantsTotalAnterior + egresosCajaTotalAnterior

    // Costos totales pre-calculados
    const costoTotalActual = costoInsumosActual + gastosTotalActual
    const costoTotalAnterior = costoInsumosAnterior + gastosTotalAnterior

    const gastosPorCategoria: Record<string, { nombre: string; monto: number; count: number }> = {}

    // Procesar gastos operativos manuales
    for (const g of gastos) {
        const cat = (g.categoria as any)?.nombre || 'Sin categoría'
        if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = { nombre: cat, monto: 0, count: 0 }
        gastosPorCategoria[cat].monto += g.monto
        gastosPorCategoria[cat].count++
    }

    // Integrar Liquidaciones en categoría Sueldos
    if (liqsTotalActual > 0) {
        const catSueldos = 'Sueldos'
        if (!gastosPorCategoria[catSueldos]) gastosPorCategoria[catSueldos] = { nombre: catSueldos, monto: 0, count: 0 }
        gastosPorCategoria[catSueldos].monto += liqsTotalActual
        gastosPorCategoria[catSueldos].count += liqs.length
    }

    // Integrar Mantenimientos en categoría Mantenimiento
    if (mantsTotalActual > 0) {
        const catMant = 'Mantenimiento'
        if (!gastosPorCategoria[catMant]) gastosPorCategoria[catMant] = { nombre: catMant, monto: 0, count: 0 }
        gastosPorCategoria[catMant].monto += mantsTotalActual
        gastosPorCategoria[catMant].count += mants.length
    }

    // Integrar Egresos de Caja agrupados por concepto bajo "Egresos Caja"
    const conceptosCajaNames = await prisma.conceptoCaja.findMany({
        where: { clave: { in: conceptosCajaTildados } },
        select: { clave: true, nombre: true }
    })
    const conceptoNameMap: Record<string, string> = {}
    for (const c of conceptosCajaNames) conceptoNameMap[c.clave] = c.nombre

    // Agrupar egresos de caja por concepto
    const egresosPorConcepto: Record<string, { monto: number; count: number }> = {}
    for (const e of egresosCajaActual) {
        const key = e.concepto
        if (!egresosPorConcepto[key]) egresosPorConcepto[key] = { monto: 0, count: 0 }
        egresosPorConcepto[key].monto += e.monto
        egresosPorConcepto[key].count++
    }
    for (const [concepto, data] of Object.entries(egresosPorConcepto)) {
        const catName = `Caja: ${conceptoNameMap[concepto] || concepto}`
        if (!gastosPorCategoria[catName]) gastosPorCategoria[catName] = { nombre: catName, monto: 0, count: 0 }
        gastosPorCategoria[catName].monto += data.monto
        gastosPorCategoria[catName].count += data.count
    }

    // ── Desglose por categoría del período anterior (para análisis de variación) ──
    const gastosPorCatAnterior: Record<string, { nombre: string; monto: number }> = {}

    for (const g of gastosAnterior) {
        const cat = (g.categoria as any)?.nombre || 'Sin categoría'
        if (!gastosPorCatAnterior[cat]) gastosPorCatAnterior[cat] = { nombre: cat, monto: 0 }
        gastosPorCatAnterior[cat].monto += g.monto
    }

    if (liqsTotalAnterior > 0) {
        if (!gastosPorCatAnterior['Sueldos']) gastosPorCatAnterior['Sueldos'] = { nombre: 'Sueldos', monto: 0 }
        gastosPorCatAnterior['Sueldos'].monto += liqsTotalAnterior
    }

    if (mantsTotalAnterior > 0) {
        if (!gastosPorCatAnterior['Mantenimiento']) gastosPorCatAnterior['Mantenimiento'] = { nombre: 'Mantenimiento', monto: 0 }
        gastosPorCatAnterior['Mantenimiento'].monto += mantsTotalAnterior
    }

    // Egresos de Caja del período anterior agrupados por concepto
    const egresosPorConceptoAnterior: Record<string, number> = {}
    for (const e of egresosCajaAnterior) {
        const key = e.concepto
        if (!egresosPorConceptoAnterior[key]) egresosPorConceptoAnterior[key] = 0
        egresosPorConceptoAnterior[key] += e.monto
    }
    for (const [concepto, monto] of Object.entries(egresosPorConceptoAnterior)) {
        const catName = `Caja: ${conceptoNameMap[concepto] || concepto}`
        if (!gastosPorCatAnterior[catName]) gastosPorCatAnterior[catName] = { nombre: catName, monto: 0 }
        gastosPorCatAnterior[catName].monto += monto
    }

    // ── Construir desglose completo de costos con variación MoM ──
    const allCatNames = new Set([
        ...Object.keys(gastosPorCategoria),
        ...Object.keys(gastosPorCatAnterior)
    ])

    const desgloseCostos = [
        // Compra de Insumos como primera categoría
        {
            nombre: 'Compra de Insumos',
            montoActual: costoInsumosActual,
            montoAnterior: costoInsumosAnterior,
            diferencia: costoInsumosActual - costoInsumosAnterior,
            variacionPct: costoInsumosAnterior > 0
                ? ((costoInsumosActual - costoInsumosAnterior) / costoInsumosAnterior) * 100
                : null,
            participacion: costoTotalActual > 0 ? (costoInsumosActual / costoTotalActual) * 100 : 0,
            items: [] as any[] // se llena después de calcular insumosItems
        },
        // Cada categoría de gastos operativos
        ...Array.from(allCatNames).map(cat => {
            const actual = gastosPorCategoria[cat]?.monto || 0
            const anterior = gastosPorCatAnterior[cat]?.monto || 0
            return {
                nombre: cat,
                montoActual: actual,
                montoAnterior: anterior,
                diferencia: actual - anterior,
                variacionPct: anterior > 0
                    ? ((actual - anterior) / anterior) * 100
                    : null,
                participacion: costoTotalActual > 0 ? (actual / costoTotalActual) * 100 : 0,
                items: [] as any[] // se llena después
            }
        })
    ].sort((a, b) => b.montoActual - a.montoActual)

    // ── 2b. Detalle unificado de TODOS los gastos operativos ──
    const gastosDetalle: any[] = []

    // Gastos manuales
    for (const g of gastos) {
        gastosDetalle.push({
            id: g.id,
            fecha: g.fecha,
            categoria: (g.categoria as any)?.nombre || 'Sin categoría',
            descripcion: g.descripcion,
            monto: g.monto,
            recurrente: g.recurrente,
            origen: 'manual'
        })
    }

    // Liquidaciones de sueldos
    for (const l of liqs) {
        gastosDetalle.push({
            id: l.id,
            fecha: l.fechaGeneracion,
            categoria: 'Sueldos',
            descripcion: `${(l as any).empleado?.nombre || ''} ${(l as any).empleado?.apellido || ''} — ${l.periodo}`,
            monto: l.totalNeto,
            recurrente: true,
            origen: 'liquidacion'
        })
    }

    // Mantenimientos de vehículos
    for (const m of mants) {
        const veh = (m as any).vehiculo
        gastosDetalle.push({
            id: m.id,
            fecha: m.fecha,
            categoria: 'Mantenimiento',
            descripcion: `${m.tipo} — ${veh?.patente || ''} ${veh?.marca || ''} ${veh?.modelo || ''} ${m.taller ? '(' + m.taller + ')' : ''}`.trim(),
            monto: m.costo,
            recurrente: false,
            origen: 'mantenimiento'
        })
    }

    // Egresos de Caja tildados
    for (const e of egresosCajaActual) {
        const catName = `Caja: ${conceptoNameMap[e.concepto] || e.concepto}`
        gastosDetalle.push({
            id: e.id,
            fecha: e.fecha,
            categoria: catName,
            descripcion: e.descripcion || conceptoNameMap[e.concepto] || e.concepto,
            monto: e.monto,
            recurrente: false,
            origen: 'caja'
        })
    }

    // Ordenar por fecha desc
    gastosDetalle.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // ── 3. Costo unitario por producto (basado en fichas técnicas) ──
    const productos = await prisma.producto.findMany({
        where: { activo: true },
        include: {
            fichasTecnicas: { include: { insumo: { select: { nombre: true, precioUnitario: true } } } },
            presentaciones: {
                where: { activo: true },
                select: { id: true, cantidad: true, precioVenta: true }
            }
        }
    })

    const costoPorProducto = productos.map(prod => {
        // Calcular costo unitario (por sanguchito)
        let costoUnitario = 0
        const detalleInsumos: { nombre: string; cantidad: number; costo: number }[] = []

        for (const ft of prod.fichasTecnicas) {
            const costo = ft.cantidadPorUnidad * (ft.insumo.precioUnitario || 0)
            costoUnitario += costo
            detalleInsumos.push({
                nombre: ft.insumo.nombre,
                cantidad: ft.cantidadPorUnidad,
                costo
            })
        }

        // Encontrar la presentación principal para calcular margen
        const presentacionPrincipal = prod.presentaciones.length > 0
            ? prod.presentaciones.sort((a, b) => b.cantidad - a.cantidad)[0]
            : null

        const precioVenta = presentacionPrincipal?.precioVenta || 0
        const cantidadPresentacion = presentacionPrincipal?.cantidad || 1
        const costoTotal = costoUnitario * cantidadPresentacion
        const margenBruto = precioVenta - costoTotal
        const margenPct = precioVenta > 0 ? (margenBruto / precioVenta) * 100 : 0

        return {
            id: prod.id,
            nombre: prod.nombre,
            codigo: prod.codigoInterno,
            costoUnitario,
            precioVenta,
            cantidadPresentacion,
            costoTotal,
            margenBruto,
            margenPct,
            detalleInsumos
        }
    }).sort((a, b) => a.margenPct - b.margenPct) // Peor margen primero

    // ── 4. Evolución de costos (últimos 6 meses desde fecha fin) ──
    const mesReferencia = endOfCurrent.getMonth() + 1
    const anioReferencia = endOfCurrent.getFullYear()

    const evolucion = []
    for (let i = 5; i >= 0; i--) {
        const m = mesReferencia - i
        let y = anioReferencia
        let mAjustado = m
        if (m <= 0) { mAjustado = m + 12; y = anioReferencia - 1 }

        const s = new Date(y, mAjustado - 1, 1)
        const e = new Date(y, mAjustado, 0, 23, 59, 59, 999)
        const { liqStart: liqFS, liqEnd: liqFE } = getLiquidacionFetchRange(s, e)

        const [compras, gast, liqsMRaw, mantsM, cajaM] = await Promise.all([
            prisma.movimientoStock.aggregate({
                where: { tipo: 'entrada', fecha: { gte: s, lte: e }, ...whereUbi },
                _sum: { costoTotal: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: { fecha: { gte: s, lte: e }, ...(ubicacionId ? { ubicacionId } : {}), movimientosStock: { none: {} } },
                _sum: { monto: true }
            }),
            prisma.liquidacionSueldo.findMany({
                where: { fechaGeneracion: { gte: liqFS, lte: liqFE }, estado: 'pagado' },
                select: { periodo: true, fechaGeneracion: true, totalNeto: true }
            }),
            prisma.mantenimientoVehiculo.aggregate({
                where: { fecha: { gte: s, lte: e } },
                _sum: { costo: true }
            }),
            // Egresos de Caja tildados
            conceptosCajaTildados.length > 0
                ? prisma.movimientoCaja.aggregate({
                    where: {
                        tipo: 'egreso',
                        concepto: { in: conceptosCajaTildados },
                        gastoId: null,
                        fecha: { gte: s, lte: e }
                    },
                    _sum: { monto: true }
                })
                : Promise.resolve({ _sum: { monto: null } })
        ])

        // Filtrar liquidaciones por período trabajado y sumar
        const liqsMFiltered = liqsMRaw.filter(l => liquidacionBelongsToPeriod(l, s, e))
        const liqsMTotal = liqsMFiltered.reduce((acc, l) => acc + l.totalNeto, 0)

        const mesNombre = new Date(y, mAjustado - 1, 1).toLocaleDateString('es-AR', { month: 'short' })
        const mGastos = (gast._sum.monto || 0) + liqsMTotal + (mantsM._sum.costo || 0) + (cajaM._sum.monto || 0)

        evolucion.push({
            label: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
            insumos: compras._sum.costoTotal || 0,
            gastos: mGastos,
            total: (compras._sum.costoTotal || 0) + mGastos
        })
    }

    // ── 5. Ranking COMPLETO de insumos por costo (sin límite) ──
    const [allInsumos, allInsumosAnterior] = await Promise.all([
        prisma.movimientoStock.groupBy({
            by: ['insumoId'],
            where: {
                tipo: 'entrada',
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...whereUbi
            },
            _sum: { costoTotal: true, cantidad: true },
            _count: true,
            orderBy: { _sum: { costoTotal: 'desc' } }
        }),
        prisma.movimientoStock.groupBy({
            by: ['insumoId'],
            where: {
                tipo: 'entrada',
                fecha: { gte: startAnterior, lte: endAnterior },
                ...whereUbi
            },
            _sum: { costoTotal: true, cantidad: true },
            _count: true
        })
    ])

    const allInsumoIds = new Set([
        ...allInsumos.map(t => t.insumoId),
        ...allInsumosAnterior.map(t => t.insumoId)
    ])
    const insumos = await prisma.insumo.findMany({
        where: { id: { in: Array.from(allInsumoIds) } },
        select: { id: true, nombre: true, unidadMedida: true, familia: { select: { nombre: true } } }
    })

    const rankingInsumos = allInsumos.map(t => {
        const insumo = insumos.find(i => i.id === t.insumoId)
        const costoTotal = t._sum.costoTotal || 0
        const cantidadTotal = t._sum.cantidad || 0
        return {
            id: t.insumoId,
            nombre: insumo?.nombre || 'Desconocido',
            familia: insumo?.familia?.nombre || 'Sin familia',
            unidad: insumo?.unidadMedida || '',
            costoTotal,
            cantidadComprada: cantidadTotal,
            precioPromedio: cantidadTotal > 0 ? costoTotal / cantidadTotal : 0,
            compras: t._count
        }
    })

    // ── 5b. Items de drill-down para desgloseCostos ──
    // Insumos: comparar por insumo individual
    const insumosItems = Array.from(allInsumoIds).map(insumoId => {
        const insumo = insumos.find(i => i.id === insumoId)
        const actual = allInsumos.find(t => t.insumoId === insumoId)
        const anterior = allInsumosAnterior.find(t => t.insumoId === insumoId)
        const montoActual = actual?._sum.costoTotal || 0
        const montoAnterior = anterior?._sum.costoTotal || 0
        return {
            nombre: insumo?.nombre || 'Desconocido',
            montoActual,
            montoAnterior,
            diferencia: montoActual - montoAnterior,
            variacionPct: montoAnterior > 0 ? ((montoActual - montoAnterior) / montoAnterior) * 100 : null
        }
    }).filter(i => i.montoActual > 0 || i.montoAnterior > 0)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))

    // Sueldos: comparar por empleado
    const sueldosMap: Record<string, { nombre: string; montoActual: number; montoAnterior: number }> = {}
    for (const l of liqs) {
        const nombre = `${(l as any).empleado?.nombre || ''} ${(l as any).empleado?.apellido || ''}`.trim() || 'Empleado'
        if (!sueldosMap[nombre]) sueldosMap[nombre] = { nombre, montoActual: 0, montoAnterior: 0 }
        sueldosMap[nombre].montoActual += l.totalNeto
    }
    for (const l of liqsAnterior) {
        const nombre = `${(l as any).empleado?.nombre || ''} ${(l as any).empleado?.apellido || ''}`.trim() || 'Empleado'
        if (!sueldosMap[nombre]) sueldosMap[nombre] = { nombre, montoActual: 0, montoAnterior: 0 }
        sueldosMap[nombre].montoAnterior += l.totalNeto
    }
    const sueldosItems = Object.values(sueldosMap).map(s => ({
        ...s,
        diferencia: s.montoActual - s.montoAnterior,
        variacionPct: s.montoAnterior > 0 ? ((s.montoActual - s.montoAnterior) / s.montoAnterior) * 100 : null
    })).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))

    // Mantenimiento: comparar por vehículo
    const mantMap: Record<string, { nombre: string; montoActual: number; montoAnterior: number }> = {}
    for (const m of mants) {
        const veh = (m as any).vehiculo
        const nombre = veh ? `${veh.patente || ''} ${veh.marca || ''} ${veh.modelo || ''}`.trim() : m.tipo
        if (!mantMap[nombre]) mantMap[nombre] = { nombre, montoActual: 0, montoAnterior: 0 }
        mantMap[nombre].montoActual += m.costo
    }
    for (const m of mantsAnterior) {
        const veh = (m as any).vehiculo
        const nombre = veh ? `${veh.patente || ''} ${veh.marca || ''} ${veh.modelo || ''}`.trim() : (m as any).tipo
        if (!mantMap[nombre]) mantMap[nombre] = { nombre, montoActual: 0, montoAnterior: 0 }
        mantMap[nombre].montoAnterior += m.costo
    }
    const mantItems = Object.values(mantMap).map(m => ({
        ...m,
        diferencia: m.montoActual - m.montoAnterior,
        variacionPct: m.montoAnterior > 0 ? ((m.montoActual - m.montoAnterior) / m.montoAnterior) * 100 : null
    })).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))

    // Gastos operativos manuales: comparar por descripción dentro de cada categoría
    const gastosItemsMap: Record<string, Record<string, { nombre: string; montoActual: number; montoAnterior: number }>> = {}
    for (const g of gastos) {
        const cat = (g.categoria as any)?.nombre || 'Sin categoría'
        if (!gastosItemsMap[cat]) gastosItemsMap[cat] = {}
        const desc = g.descripcion || 'Sin descripción'
        if (!gastosItemsMap[cat][desc]) gastosItemsMap[cat][desc] = { nombre: desc, montoActual: 0, montoAnterior: 0 }
        gastosItemsMap[cat][desc].montoActual += g.monto
    }
    for (const g of gastosAnterior) {
        const cat = (g.categoria as any)?.nombre || 'Sin categoría'
        if (!gastosItemsMap[cat]) gastosItemsMap[cat] = {}
        const desc = (g as any).descripcion || 'Sin descripción'
        if (!gastosItemsMap[cat][desc]) gastosItemsMap[cat][desc] = { nombre: desc, montoActual: 0, montoAnterior: 0 }
        gastosItemsMap[cat][desc].montoAnterior += g.monto
    }

    // Mapeo de items por categoría para asignar al desglose
    const itemsPorCategoria: Record<string, any[]> = {}
    for (const [cat, items] of Object.entries(gastosItemsMap)) {
        itemsPorCategoria[cat] = Object.values(items).map(i => ({
            ...i,
            diferencia: i.montoActual - i.montoAnterior,
            variacionPct: i.montoAnterior > 0 ? ((i.montoActual - i.montoAnterior) / i.montoAnterior) * 100 : null
        })).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    }
    itemsPorCategoria['Sueldos'] = sueldosItems
    itemsPorCategoria['Mantenimiento'] = mantItems

    // Egresos de Caja: drill-down por descripción dentro de cada concepto
    const cajaItemsMap: Record<string, Record<string, { nombre: string; montoActual: number; montoAnterior: number }>> = {}
    for (const e of egresosCajaActual) {
        const catName = `Caja: ${conceptoNameMap[e.concepto] || e.concepto}`
        if (!cajaItemsMap[catName]) cajaItemsMap[catName] = {}
        const desc = e.descripcion || 'Sin descripción'
        if (!cajaItemsMap[catName][desc]) cajaItemsMap[catName][desc] = { nombre: desc, montoActual: 0, montoAnterior: 0 }
        cajaItemsMap[catName][desc].montoActual += e.monto
    }
    for (const e of egresosCajaAnterior) {
        const catName = `Caja: ${conceptoNameMap[e.concepto] || e.concepto}`
        if (!cajaItemsMap[catName]) cajaItemsMap[catName] = {}
        const desc = e.descripcion || 'Sin descripción'
        if (!cajaItemsMap[catName][desc]) cajaItemsMap[catName][desc] = { nombre: desc, montoActual: 0, montoAnterior: 0 }
        cajaItemsMap[catName][desc].montoAnterior += e.monto
    }
    for (const [catName, items] of Object.entries(cajaItemsMap)) {
        itemsPorCategoria[catName] = Object.values(items).map(i => ({
            ...i,
            diferencia: i.montoActual - i.montoAnterior,
            variacionPct: i.montoAnterior > 0 ? ((i.montoActual - i.montoAnterior) / i.montoAnterior) * 100 : null
        })).sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    }

    // Asignar items de drill-down a cada entrada del desglose
    for (const entry of desgloseCostos) {
        if (entry.nombre === 'Compra de Insumos') {
            entry.items = insumosItems
        } else if (itemsPorCategoria[entry.nombre]) {
            entry.items = itemsPorCategoria[entry.nombre]
        }
    }

    // ── 6. Gasto por Proveedor ──
    const comprasProveedor = await prisma.movimientoStock.groupBy({
        by: ['proveedorId'],
        where: {
            tipo: 'entrada',
            fecha: { gte: startOfCurrent, lte: endOfCurrent },
            proveedorId: { not: null },
            ...whereUbi
        },
        _sum: { costoTotal: true },
        _count: true,
        orderBy: { _sum: { costoTotal: 'desc' } }
    })

    const proveedorIds = comprasProveedor.map(c => c.proveedorId!).filter(Boolean)
    const proveedores = await prisma.proveedor.findMany({
        where: { id: { in: proveedorIds } },
        select: { id: true, nombre: true }
    })

    const gastoPorProveedor = comprasProveedor.map(c => {
        const prov = proveedores.find(p => p.id === c.proveedorId)
        return {
            nombre: prov?.nombre || 'Sin proveedor',
            costoTotal: c._sum.costoTotal || 0,
            compras: c._count
        }
    })

    // ── 7. Detalle de compras (facturas/remitos individuales) ──
    const comprasDetalle = await prisma.movimientoStock.findMany({
        where: {
            tipo: 'entrada',
            fecha: { gte: startOfCurrent, lte: endOfCurrent },
            ...whereUbi
        },
        select: {
            id: true,
            fecha: true,
            cantidad: true,
            costoTotal: true,
            numeroFactura: true,
            observaciones: true,
            insumo: { select: { nombre: true, unidadMedida: true } },
            proveedor: { select: { nombre: true } }
        },
        orderBy: { fecha: 'desc' }
    })

    const comprasFormateadas = comprasDetalle.map(c => ({
        id: c.id,
        fecha: c.fecha,
        insumo: c.insumo.nombre,
        unidad: c.insumo.unidadMedida,
        cantidad: c.cantidad,
        costoTotal: c.costoTotal || 0,
        precioUnitario: c.cantidad > 0 && c.costoTotal ? c.costoTotal / c.cantidad : 0,
        proveedor: c.proveedor?.nombre || '—',
        factura: c.numeroFactura || '—',
        observaciones: c.observaciones || ''
    }))

    return {
        desde: desdeIso, hasta: hastaIso,
        kpis: {
            costoInsumosActual,
            costoInsumosAnterior,
            gastosTotalActual,
            gastosTotalAnterior,
            costoTotal: costoTotalActual,
            costoTotalAnterior,
            // Margen real: ventas vs costos totales
            ventasTotalActual,
            ventasTotalAnterior,
            gananciaActual: ventasTotalActual - (costoInsumosActual + gastosTotalActual),
            gananciaAnterior: ventasTotalAnterior - (costoInsumosAnterior + gastosTotalAnterior),
            margenReal: ventasTotalActual > 0
                ? ((ventasTotalActual - (costoInsumosActual + gastosTotalActual)) / ventasTotalActual) * 100
                : 0,
            margenRealAnterior: ventasTotalAnterior > 0
                ? ((ventasTotalAnterior - (costoInsumosAnterior + gastosTotalAnterior)) / ventasTotalAnterior) * 100
                : 0,
            totalCompras: comprasDetalle.length,
            totalProveedores: gastoPorProveedor.length
        },
        gastosPorCategoria: Object.values(gastosPorCategoria).sort((a, b) => b.monto - a.monto),
        desgloseCostos,
        costoPorProducto,
        evolucion,
        rankingInsumos,
        gastoPorProveedor,
        comprasDetalle: comprasFormateadas,
        gastosDetalle
    }
}

