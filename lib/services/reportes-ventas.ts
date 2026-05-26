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

    // ── Pedidos del mes actual y del período anterior con detalles ──
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
        prisma.pedido.findMany({
            where: whereAnterior,
            include: {
                detalles: {
                    include: {
                        presentacion: {
                            include: { producto: { select: { id: true, nombre: true, codigoInterno: true } } }
                        }
                    }
                }
            }
        })
    ])

    // ── KPIs Globales ──
    let facturacionTotal = 0
    let unidadesTotales = 0
    const pedidoCount = pedidos.length

    // ── Desglose por producto ──
    const porProducto: Record<string, {
        nombre: string; codigo: string;
        cantidad: number; paquetes: number; importe: number; pedidos: number
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
            const presId = det.presentacion.id
            
            // Determinar si agrupamos por presentación o por producto
            // Premium y Elegidos se agrupan por producto (ignoran presentación)
            const esAgrupado = ['PRE', 'ELE'].includes(prod.codigoInterno)
            const groupKey = esAgrupado ? prod.id : presId
            
            if (!porProducto[groupKey]) {
                porProducto[groupKey] = {
                    nombre: esAgrupado ? prod.nombre : `${prod.nombre} x${det.presentacion.cantidad}`,
                    codigo: prod.codigoInterno,
                    cantidad: 0,
                    paquetes: 0,
                    importe: 0,
                    pedidos: 0
                }
            }
            porProducto[groupKey].cantidad += det.cantidad * det.presentacion.cantidad
            porProducto[groupKey].paquetes += det.cantidad
            porProducto[groupKey].importe += det.cantidad * det.precioUnitario
            porProducto[groupKey].pedidos++

            // También sumar a la cantidad del cliente
            porCliente[cId].cantidad += det.cantidad * det.presentacion.cantidad
        }
    }

    const ticketPromedio = pedidoCount > 0 ? facturacionTotal / pedidoCount : 0

    // ── KPIs Período Anterior ──
    let facturacionAnterior = 0
    let unidadesAnterior = 0
    const pedidoCountAnterior = pedidosAnterior.length

    for (const ped of pedidosAnterior) {
        facturacionAnterior += ped.totalImporte
        unidadesAnterior += ped.totalUnidades
    }
    const ticketPromedioAnterior = pedidoCountAnterior > 0 ? facturacionAnterior / pedidoCountAnterior : 0

    // ── Desglose por producto del período anterior para variación MoM ──
    const porProductoAnterior: Record<string, { paquetes: number }> = {}
    for (const ped of pedidosAnterior) {
        for (const det of ped.detalles) {
            const prod = det.presentacion.producto
            const presId = det.presentacion.id
            const esAgrupado = ['PRE', 'ELE'].includes(prod.codigoInterno)
            const groupKey = esAgrupado ? prod.id : presId

            if (!porProductoAnterior[groupKey]) {
                porProductoAnterior[groupKey] = { paquetes: 0 }
            }
            porProductoAnterior[groupKey].paquetes += det.cantidad
        }
    }

    // ── Ordenar y formatear rankings ──
    const rankingProductos = Object.entries(porProducto)
        .sort(([, a], [, b]) => b.importe - a.importe)
        .map(([groupKey, p], i) => {
            const ant = porProductoAnterior[groupKey]
            const paquetesAnterior = ant ? ant.paquetes : 0
            const cambioPct = paquetesAnterior > 0
                ? ((p.paquetes - paquetesAnterior) / paquetesAnterior) * 100
                : null

            return {
                ...p,
                planchas: p.cantidad / 8,
                paquetesAnterior,
                cambioPct,
                ranking: i + 1,
                participacion: facturacionTotal > 0 ? (p.importe / facturacionTotal) * 100 : 0
            }
        })

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
            ticketPromedioAnterior,
            // Planchas
            planchasTotales: unidadesTotales / 8,
            planchasAnterior: unidadesAnterior / 8
        },
        rankingProductos,
        rankingClientes,
        tendenciaDiaria,
        mediosPago
    }
}
