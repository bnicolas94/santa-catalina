import { prisma } from '@/lib/prisma'

/**
 * Ajusta el rango de fechas para consultas de liquidaciones de sueldos.
 * Regla de negocio: Si la fecha de pago (fechaGeneracion) de una liquidación cae
 * dentro de los primeros 6 días de un mes, se atribuye al mes anterior.
 * 
 * Esto significa que para el reporte de un mes M:
 * - Se incluyen liquidaciones desde el día 7 del mes M
 * - Hasta el día 6 del mes M+1 (inclusive)
 * 
 * Ejemplo: Para el reporte de Abril (1/4 - 30/4):
 * - Se toman liquidaciones del 7/4 al 6/5
 * - Una liquidación del 3/5 se cuenta como gasto de Abril
 * - Una liquidación del 3/4 se cuenta como gasto de Marzo (no Abril)
 */
export function getLiquidacionDateRange(periodStart: Date, periodEnd: Date) {
    // Inicio: día 7 del mes del inicio del período
    const liqStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), 7, 0, 0, 0, 0)

    // Fin: día 6 del mes siguiente al fin del período
    const liqEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 6, 23, 59, 59, 999)

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
    // Ajustar rango de fechas para liquidaciones (día 7 al día 6 del mes siguiente)
    const { liqStart: liqStartActual, liqEnd: liqEndActual } = getLiquidacionDateRange(startOfCurrent, endOfCurrent)
    const { liqStart: liqStartAnterior, liqEnd: liqEndAnterior } = getLiquidacionDateRange(startAnterior, endAnterior)

    const [gastos, liqs, mants, gastosAnterior, liqsAnterior, mantsAnterior] = await Promise.all([
        // Gastos operativos actuales (excluyendo los vinculados a movimientos de stock)
        prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...(ubicacionId ? { ubicacionId } : {}),
                movimientosStock: { none: {} }
            },
            include: { categoria: true }
        }),
        // Liquidaciones actuales (rango ajustado: día 7 del mes → día 6 del mes siguiente)
        prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: { gte: liqStartActual, lte: liqEndActual },
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
                fechaGeneracion: { gte: liqStartAnterior, lte: liqEndAnterior },
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

    const gastosTotalActualBase = gastos.reduce((acc, g) => acc + g.monto, 0)
    const liqsTotalActual = liqs.reduce((acc, l) => acc + l.totalNeto, 0)
    const mantsTotalActual = mants.reduce((acc, m) => acc + m.costo, 0)
    const gastosTotalActual = gastosTotalActualBase + liqsTotalActual + mantsTotalActual

    const gastosTotalAnteriorBase = gastosAnterior.reduce((acc: number, g: any) => acc + g.monto, 0)
    const liqsTotalAnterior = liqsAnterior.reduce((acc: number, l: any) => acc + l.totalNeto, 0)
    const mantsTotalAnterior = mantsAnterior.reduce((acc: number, m: any) => acc + m.costo, 0)
    const gastosTotalAnterior = gastosTotalAnteriorBase + liqsTotalAnterior + mantsTotalAnterior

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
        const { liqStart: liqS, liqEnd: liqE } = getLiquidacionDateRange(s, e)

        const [compras, gast, liqsM, mantsM] = await Promise.all([
            prisma.movimientoStock.aggregate({
                where: { tipo: 'entrada', fecha: { gte: s, lte: e }, ...whereUbi },
                _sum: { costoTotal: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: { fecha: { gte: s, lte: e }, ...(ubicacionId ? { ubicacionId } : {}), movimientosStock: { none: {} } },
                _sum: { monto: true }
            }),
            prisma.liquidacionSueldo.aggregate({
                where: { fechaGeneracion: { gte: liqS, lte: liqE }, estado: 'pagado' },
                _sum: { totalNeto: true }
            }),
            prisma.mantenimientoVehiculo.aggregate({
                where: { fecha: { gte: s, lte: e } },
                _sum: { costo: true }
            })
        ])

        const mesNombre = new Date(y, mAjustado - 1, 1).toLocaleDateString('es-AR', { month: 'short' })
        const mGastos = (gast._sum.monto || 0) + (liqsM._sum.totalNeto || 0) + (mantsM._sum.costo || 0)

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

