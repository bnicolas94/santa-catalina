import { prisma } from '@/lib/prisma'

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

    // ── 2. Gastos operativos, Sueldos y Mantenimientos ──
    const [gastos, liqs, mants, gastosAnterior, liqsAnterior, mantsAnterior] = await Promise.all([
        // Gastos operativos actuales
        prisma.gastoOperativo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent },
                ...(ubicacionId ? { ubicacionId } : {})
            },
            include: { categoria: true }
        }),
        // Liquidaciones actuales
        prisma.liquidacionSueldo.findMany({
            where: {
                fechaGeneracion: { gte: startOfCurrent, lte: endOfCurrent },
                estado: incluirTodo ? { in: ['pagado', 'generado'] } : 'pagado'
            }
        }),
        // Mantenimientos actuales
        prisma.mantenimientoVehiculo.findMany({
            where: {
                fecha: { gte: startOfCurrent, lte: endOfCurrent }
            }
        }),
        // Totales periodo anterior
        prisma.gastoOperativo.aggregate({
            where: {
                fecha: { gte: startAnterior, lte: endAnterior },
                ...(ubicacionId ? { ubicacionId } : {})
            },
            _sum: { monto: true }
        }),
        prisma.liquidacionSueldo.aggregate({
            where: {
                fechaGeneracion: { gte: startAnterior, lte: endAnterior },
                estado: incluirTodo ? { in: ['pagado', 'generado'] } : 'pagado'
            },
            _sum: { totalNeto: true }
        }),
        prisma.mantenimientoVehiculo.aggregate({
            where: {
                fecha: { gte: startAnterior, lte: endAnterior }
            },
            _sum: { costo: true }
        })
    ])

    const gastosTotalActualBase = gastos.reduce((acc, g) => acc + g.monto, 0)
    const liqsTotalActual = liqs.reduce((acc, l) => acc + l.totalNeto, 0)
    const mantsTotalActual = mants.reduce((acc, m) => acc + m.costo, 0)
    const gastosTotalActual = gastosTotalActualBase + liqsTotalActual + mantsTotalActual

    const gastosTotalAnterior = (gastosAnterior._sum.monto || 0) + (liqsAnterior._sum.totalNeto || 0) + (mantsAnterior._sum.costo || 0)

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

        const [compras, gast, liqsM, mantsM] = await Promise.all([
            prisma.movimientoStock.aggregate({
                where: { tipo: 'entrada', fecha: { gte: s, lte: e }, ...whereUbi },
                _sum: { costoTotal: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: { fecha: { gte: s, lte: e }, ...(ubicacionId ? { ubicacionId } : {}) },
                _sum: { monto: true }
            }),
            prisma.liquidacionSueldo.aggregate({
                where: { fechaGeneracion: { gte: s, lte: e }, estado: 'pagado' },
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
    const allInsumos = await prisma.movimientoStock.groupBy({
        by: ['insumoId'],
        where: {
            tipo: 'entrada',
            fecha: { gte: startOfCurrent, lte: endOfCurrent },
            ...whereUbi
        },
        _sum: { costoTotal: true, cantidad: true },
        _count: true,
        orderBy: { _sum: { costoTotal: 'desc' } }
    })

    const insumoIds = allInsumos.map(t => t.insumoId)
    const insumos = await prisma.insumo.findMany({
        where: { id: { in: insumoIds } },
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
            costoTotal: costoInsumosActual + gastosTotalActual,
            costoTotalAnterior: costoInsumosAnterior + gastosTotalAnterior,
            margenPromedioProductos: costoPorProducto.length > 0
                ? costoPorProducto.reduce((acc, p) => acc + p.margenPct, 0) / costoPorProducto.length
                : 0,
            totalCompras: comprasDetalle.length,
            totalProveedores: gastoPorProveedor.length
        },
        gastosPorCategoria: Object.values(gastosPorCategoria).sort((a, b) => b.monto - a.monto),
        costoPorProducto,
        evolucion,
        rankingInsumos,
        gastoPorProveedor,
        comprasDetalle: comprasFormateadas
    }
}

