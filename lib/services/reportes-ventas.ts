import { prisma } from '@/lib/prisma'

/**
 * Servicio de reportes de ventas.
 * Analiza facturación, volumen, ticket promedio, top productos y top clientes.
 */
export async function getVentasReport(
    desdeIso: string,
    hastaIso: string,
    ubicacionId?: string,
    incluirTodo = false
) {
    const startOfCurrent = new Date(desdeIso)
    const endOfCurrent = new Date(hastaIso)

    // Período anterior para comparativa
    const diffMs = endOfCurrent.getTime() - startOfCurrent.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const endAnterior = new Date(startOfCurrent)
    endAnterior.setDate(endAnterior.getDate() - 1)
    endAnterior.setHours(23, 59, 59, 999)

    const startAnterior = new Date(endAnterior)
    startAnterior.setDate(startAnterior.getDate() - diffDays + 1)
    startAnterior.setHours(0, 0, 0, 0)

    const whereBase: any = {
        estado: incluirTodo ? { in: ['entregado', 'confirmado', 'en_camino', 'pendiente'] } : 'entregado',
        fechaEntrega: { gte: startOfCurrent, lte: endOfCurrent }
    }
    if (ubicacionId) whereBase.ubicacionId = ubicacionId

    const whereAnterior: any = {
        estado: incluirTodo ? { in: ['entregado', 'confirmado', 'en_camino', 'pendiente'] } : 'entregado',
        fechaEntrega: { gte: startAnterior, lte: endAnterior }
    }
    if (ubicacionId) whereAnterior.ubicacionId = ubicacionId

    // ── Pedidos del mes actual con detalles ──
    const [pedidos, pedidosAnterior] = await Promise.all([
        prisma.pedido.findMany({
            where: whereBase,
            include: {
                cliente: { select: { id: true, nombreComercial: true, zona: true } },
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } }
                        }
                    }
                }
            }
        }),
        prisma.pedido.aggregate({
            where: whereAnterior,
            _sum: { totalImporte: true, totalUnidades: true },
            _count: true
        })
    ])

    // ── KPIs Globales ──
    let facturacionTotal = 0
    let unidadesTotales = 0
    const pedidoCount = pedidos.length

    // ── Desglose por producto ──
    const porProducto: Record<string, {
        nombre: string; codigo: string;
        cantidad: number; importe: number; pedidos: number
    }> = {}

    // ── Desglose por cliente ──
    const porCliente: Record<string, {
        nombre: string; zona: string;
        cantidad: number; importe: number; pedidos: number
    }> = {}

    // ── Desglose por medio de pago ──
    const porMedioPago: Record<string, { count: number; importe: number }> = {}

    // ── Tendencia diaria ──
    const porDia: Record<string, { importe: number; pedidos: number; unidades: number }> = {}

    for (const ped of pedidos) {
        facturacionTotal += ped.totalImporte
        unidadesTotales += ped.totalUnidades

        // Medio de pago
        const mp = ped.medioPago || 'efectivo'
        if (!porMedioPago[mp]) porMedioPago[mp] = { count: 0, importe: 0 }
        porMedioPago[mp].count++
        porMedioPago[mp].importe += ped.totalImporte

        // Por día
        const diaKey = ped.fechaEntrega.toISOString().split('T')[0]
        if (!porDia[diaKey]) porDia[diaKey] = { importe: 0, pedidos: 0, unidades: 0 }
        porDia[diaKey].importe += ped.totalImporte
        porDia[diaKey].pedidos++
        porDia[diaKey].unidades += ped.totalUnidades

        // Por cliente
        const cId = ped.clienteId
        if (!porCliente[cId]) {
            porCliente[cId] = {
                nombre: ped.cliente.nombreComercial,
                zona: ped.cliente.zona || 'Sin zona',
                cantidad: 0, importe: 0, pedidos: 0
            }
        }
        porCliente[cId].pedidos++
        porCliente[cId].importe += ped.totalImporte

        // Por producto (detalles)
        for (const det of ped.detalles) {
            const prod = det.presentacion.producto
            if (!porProducto[prod.id]) {
                porProducto[prod.id] = {
                    nombre: prod.nombre,
                    codigo: prod.codigoInterno,
                    cantidad: 0, importe: 0, pedidos: 0
                }
            }
            porProducto[prod.id].cantidad += det.cantidad * det.presentacion.cantidad
            porProducto[prod.id].importe += det.cantidad * det.precioUnitario
            porProducto[prod.id].pedidos++

            // También sumar a la cantidad del cliente
            porCliente[cId].cantidad += det.cantidad * det.presentacion.cantidad
        }
    }

    const ticketPromedio = pedidoCount > 0 ? facturacionTotal / pedidoCount : 0

    // ── Período anterior para deltas ──
    const facturacionAnterior = pedidosAnterior._sum.totalImporte || 0
    const pedidoCountAnterior = pedidosAnterior._count || 0
    const unidadesAnterior = pedidosAnterior._sum.totalUnidades || 0
    const ticketPromedioAnterior = pedidoCountAnterior > 0 ? facturacionAnterior / pedidoCountAnterior : 0

    // ── Ordenar y formatear rankings ──
    const rankingProductos = Object.values(porProducto)
        .sort((a, b) => b.importe - a.importe)
        .map((p, i) => ({
            ...p,
            ranking: i + 1,
            participacion: facturacionTotal > 0 ? (p.importe / facturacionTotal) * 100 : 0
        }))

    const rankingClientes = Object.values(porCliente)
        .sort((a, b) => b.importe - a.importe)
        .map((c, i) => ({
            ...c,
            ranking: i + 1,
            participacion: facturacionTotal > 0 ? (c.importe / facturacionTotal) * 100 : 0
        }))

    // ── Tendencia diaria ordenada ──
    const tendenciaDiaria = Object.entries(porDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, data]) => ({
            fecha,
            label: new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
            ...data
        }))

    // ── Medios de pago ──
    const mediosPago = Object.entries(porMedioPago)
        .sort((a, b) => b[1].importe - a[1].importe)
        .map(([medio, data]) => ({
            medio: medio.charAt(0).toUpperCase() + medio.slice(1),
            ...data,
            participacion: facturacionTotal > 0 ? (data.importe / facturacionTotal) * 100 : 0
        }))

    return {
        desde: desdeIso, hasta: hastaIso,
        kpis: {
            facturacionTotal,
            unidadesTotales,
            pedidoCount,
            ticketPromedio,
            // Comparativa vs anterior
            facturacionAnterior,
            unidadesAnterior,
            pedidoCountAnterior,
            ticketPromedioAnterior
        },
        rankingProductos,
        rankingClientes,
        tendenciaDiaria,
        mediosPago
    }
}
