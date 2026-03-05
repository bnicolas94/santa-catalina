import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// GET /api/dashboard — KPIs consolidados
export async function GET() {
    try {
        const now = new Date()
        const todayStr = now.toLocaleDateString('en-CA') // YYYY-MM-DD

        // Rango amplio para capturar tanto UTC medianoche como local medianoche
        const startOfDay = new Date(todayStr + 'T00:00:00Z') // Forzamos UTC 00:00
        const endOfDay = new Date(todayStr + 'T23:59:59Z')   // Forzamos UTC 23:59

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        const [
            pedidosHoy,
            pedidosPendientes,
            pedidosEntregadosMes,
            insumosAlerta,
            entregasHoy,
            gastosMes,
            comprasPendientes,
            ultimosMovimientos,
            ultimosPedidos,
        ] = await Promise.all([
            // Pedidos creados hoy
            prisma.pedido.count({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } }
            }),
            // Pedidos en estado pendiente
            prisma.pedido.count({
                where: { estado: 'pendiente' }
            }),
            // Pedidos entregados del mes (para calcular ingresos)
            prisma.pedido.aggregate({
                where: { estado: 'entregado', fechaEntrega: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { totalImporte: true },
                _count: true,
            }),
            // Insumos bajo mínimo
            prisma.$queryRawUnsafe<{ count: number }[]>(
                `SELECT COUNT(*) as count FROM insumos WHERE activo = 1 AND stock_actual < stock_minimo AND stock_minimo > 0`
            ),
            // Entregas del día
            prisma.entrega.count({
                where: { createdAt: { gte: startOfDay, lte: endOfDay } }
            }),
            // Gastos del mes
            prisma.gastoOperativo.aggregate({
                where: { fecha: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { monto: true },
            }),
            // Compras por pagar (SÓLO las pendientes REALES)
            prisma.movimientoStock.count({
                where: { tipo: 'entrada', estadoPago: 'pendiente' }
            }),
            // Últimos 5 movimientos de stock
            prisma.movimientoStock.findMany({
                orderBy: { fecha: 'desc' },
                take: 5,
                include: {
                    insumo: { select: { nombre: true, unidadMedida: true } },
                    proveedor: { select: { nombre: true } },
                }
            }),
            // Últimos 5 pedidos
            prisma.pedido.findMany({
                orderBy: { fechaPedido: 'desc' },
                take: 5,
                include: {
                    cliente: { select: { nombreComercial: true } },
                }
            }),
        ])

        // Lotes producidos hoy agrupados por ubicación
        const lotesHoyPorUbi = await prisma.lote.groupBy({
            by: ['ubicacionId'],
            where: { fechaProduccion: { gte: startOfDay, lte: endOfDay } },
            _sum: { unidadesProducidas: true },
            _count: true,
        })

        // Obtener nombres de las ubicaciones
        const ubicaciones = await prisma.ubicacion.findMany({
            where: { id: { in: lotesHoyPorUbi.map(l => l.ubicacionId) } },
            select: { id: true, nombre: true }
        })

        const produccionPorUbicacion = lotesHoyPorUbi.map(l => ({
            ubicacion: ubicaciones.find(u => u.id === l.ubicacionId)?.nombre || 'Sin nombre',
            unidades: l._sum.unidadesProducidas || 0,
            lotes: l._count
        }))

        const insumosAlertaCount = insumosAlerta?.[0]?.count ?? 0

        return NextResponse.json({
            pedidosHoy,
            pedidosPendientes,
            ingresosMes: pedidosEntregadosMes._sum.totalImporte ?? 0,
            pedidosEntregadosMes: pedidosEntregadosMes._count,
            lotesHoy: lotesHoyPorUbi.reduce((acc, l) => acc + l._count, 0),
            unidadesHoy: lotesHoyPorUbi.reduce((acc, l) => acc + (l._sum.unidadesProducidas || 0), 0),
            produccionPorUbicacion,
            insumosAlerta: Number(insumosAlertaCount),
            entregasHoy,
            gastosMes: gastosMes._sum.monto ?? 0,
            comprasPendientes,
            ultimosMovimientos,
            ultimosPedidos,
        })
    } catch (error) {
        console.error('Error obteniendo datos del dashboard:', error)
        return NextResponse.json({ error: 'Error al cargar el dashboard' }, { status: 500 })
    }
}
