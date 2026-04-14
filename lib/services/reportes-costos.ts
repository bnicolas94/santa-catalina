import { prisma } from '@/lib/prisma'

/**
 * Servicio de reportes de costos.
 * Analiza: costo por producto, margen bruto, evolución de precios de insumos, gastos operativos.
 */
export async function getCostosReport(
    mes: number,
    anio: number,
    ubicacionId?: string
) {
    const startOfMonth = new Date(anio, mes - 1, 1)
    const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999)

    // Período anterior
    const startAnterior = new Date(anio, mes - 2, 1)
    const endAnterior = new Date(anio, mes - 1, 0, 23, 59, 59, 999)

    const whereUbi = ubicacionId ? { ubicacionId } : {}

    // ── 1. Costo total de insumos comprados ──
    const [comprasActual, comprasAnterior] = await Promise.all([
        prisma.movimientoStock.aggregate({
            where: {
                tipo: 'entrada',
                fecha: { gte: startOfMonth, lte: endOfMonth },
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

    // ── 2. Gastos operativos por categoría ──
    const gastos = await prisma.gastoOperativo.findMany({
        where: {
            fecha: { gte: startOfMonth, lte: endOfMonth },
            ...(ubicacionId ? { ubicacionId } : {})
        },
        include: { categoria: true }
    })

    let gastosTotalActual = 0
    const gastosPorCategoria: Record<string, { nombre: string; monto: number; count: number }> = {}

    for (const g of gastos) {
        gastosTotalActual += g.monto
        const cat = (g.categoria as any)?.nombre || 'Sin categoría'
        if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = { nombre: cat, monto: 0, count: 0 }
        gastosPorCategoria[cat].monto += g.monto
        gastosPorCategoria[cat].count++
    }

    const gastosAnterior = await prisma.gastoOperativo.aggregate({
        where: {
            fecha: { gte: startAnterior, lte: endAnterior },
            ...(ubicacionId ? { ubicacionId } : {})
        },
        _sum: { monto: true }
    })
    const gastosTotalAnterior = gastosAnterior._sum.monto || 0

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

    // ── 4. Evolución de costos (últimos 6 meses) ──
    const evolucion = []
    for (let i = 5; i >= 0; i--) {
        const m = mes - i
        let y = anio
        let mAjustado = m
        if (m <= 0) { mAjustado = m + 12; y = anio - 1 }

        const s = new Date(y, mAjustado - 1, 1)
        const e = new Date(y, mAjustado, 0, 23, 59, 59, 999)

        const [compras, gast] = await Promise.all([
            prisma.movimientoStock.aggregate({
                where: { tipo: 'entrada', fecha: { gte: s, lte: e }, ...whereUbi },
                _sum: { costoTotal: true }
            }),
            prisma.gastoOperativo.aggregate({
                where: { fecha: { gte: s, lte: e }, ...(ubicacionId ? { ubicacionId } : {}) },
                _sum: { monto: true }
            })
        ])

        const mesNombre = new Date(y, mAjustado - 1, 1).toLocaleDateString('es-AR', { month: 'short' })
        evolucion.push({
            label: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
            insumos: compras._sum.costoTotal || 0,
            gastos: gast._sum.monto || 0,
            total: (compras._sum.costoTotal || 0) + (gast._sum.monto || 0)
        })
    }

    // ── 5. Top insumos más costosos ──
    const topInsumos = await prisma.movimientoStock.groupBy({
        by: ['insumoId'],
        where: {
            tipo: 'entrada',
            fecha: { gte: startOfMonth, lte: endOfMonth },
            ...whereUbi
        },
        _sum: { costoTotal: true, cantidad: true },
        _count: true,
        orderBy: { _sum: { costoTotal: 'desc' } },
        take: 10
    })

    const insumoIds = topInsumos.map(t => t.insumoId)
    const insumos = await prisma.insumo.findMany({
        where: { id: { in: insumoIds } },
        select: { id: true, nombre: true, unidadMedida: true }
    })

    const rankingInsumos = topInsumos.map(t => {
        const insumo = insumos.find(i => i.id === t.insumoId)
        return {
            nombre: insumo?.nombre || 'Desconocido',
            unidad: insumo?.unidadMedida || '',
            costoTotal: t._sum.costoTotal || 0,
            cantidadComprada: t._sum.cantidad || 0,
            compras: t._count
        }
    })

    return {
        mes, anio,
        kpis: {
            costoInsumosActual,
            costoInsumosAnterior,
            gastosTotalActual,
            gastosTotalAnterior,
            costoTotal: costoInsumosActual + gastosTotalActual,
            costoTotalAnterior: costoInsumosAnterior + gastosTotalAnterior,
            margenPromedioProductos: costoPorProducto.length > 0
                ? costoPorProducto.reduce((acc, p) => acc + p.margenPct, 0) / costoPorProducto.length
                : 0
        },
        gastosPorCategoria: Object.values(gastosPorCategoria).sort((a, b) => b.monto - a.monto),
        costoPorProducto,
        evolucion,
        rankingInsumos
    }
}
