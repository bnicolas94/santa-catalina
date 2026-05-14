import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/insumos/[id]/historial
 * Devuelve el historial completo de movimientos de stock para un insumo,
 * incluyendo evolución de precios, facturas, proveedores y totales.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }

        const { id } = await params

        // Parse optional date filters
        const url = new URL(request.url)
        const desdeParam = url.searchParams.get('desde')
        const hastaParam = url.searchParams.get('hasta')

        const fechaFilter: any = {}
        if (desdeParam) fechaFilter.gte = new Date(desdeParam)
        if (hastaParam) fechaFilter.lte = new Date(hastaParam)
        const hasFechaFilter = Object.keys(fechaFilter).length > 0

        // Datos del insumo
        const insumo = await prisma.insumo.findUnique({
            where: { id },
            select: {
                id: true,
                nombre: true,
                unidadMedida: true,
                precioUnitario: true,
                stockActual: true,
                stockMinimo: true,
                unidadSecundaria: true,
                factorConversion: true,
                stockActualSecundario: true,
                proveedor: { select: { nombre: true } },
                familia: { select: { nombre: true, color: true } }
            }
        })

        if (!insumo) {
            return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 })
        }

        // Movimientos de este insumo, con filtro de fecha opcional
        const movimientos = await prisma.movimientoStock.findMany({
            where: {
                insumoId: id,
                ...(hasFechaFilter ? { fecha: fechaFilter } : {})
            },
            select: {
                id: true,
                tipo: true,
                cantidad: true,
                costoTotal: true,
                fecha: true,
                numeroFactura: true,
                observaciones: true,
                estadoPago: true,
                montoPagado: true,
                cantidadSecundaria: true,
                proveedor: { select: { nombre: true } },
                ubicacion: { select: { nombre: true } }
            },
            orderBy: { fecha: 'desc' }
        })

        // Totales agregados
        const entradas = movimientos.filter(m => m.tipo === 'entrada')
        const salidas = movimientos.filter(m => m.tipo !== 'entrada')

        const totalGastado = entradas.reduce((acc, m) => acc + (m.costoTotal || 0), 0)
        const totalCantidadComprada = entradas.reduce((acc, m) => acc + m.cantidad, 0)
        const totalFacturas = new Set(entradas.map(m => m.numeroFactura).filter(Boolean)).size
        const precioPromedio = totalCantidadComprada > 0 ? totalGastado / totalCantidadComprada : 0

        // Evolución de precios (precio por unidad en cada compra)
        const evolucionPrecios = entradas
            .filter(m => m.costoTotal && m.cantidad > 0)
            .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
            .map(m => ({
                fecha: m.fecha,
                precioUnitario: (m.costoTotal || 0) / m.cantidad,
                cantidad: m.cantidad,
                costoTotal: m.costoTotal || 0,
                proveedor: m.proveedor?.nombre || '—',
                factura: m.numeroFactura || '—'
            }))

        // Gasto por mes (últimos 12 meses)
        const ahora = new Date()
        const gastoMensual = []
        for (let i = 11; i >= 0; i--) {
            const m = ahora.getMonth() - i
            let y = ahora.getFullYear()
            let mAjustado = m
            if (m < 0) { mAjustado = m + 12; y-- }

            const inicio = new Date(y, mAjustado, 1)
            const fin = new Date(y, mAjustado + 1, 0, 23, 59, 59, 999)

            const mesEntradas = entradas.filter(e => {
                const f = new Date(e.fecha)
                return f >= inicio && f <= fin
            })

            const mesNombre = inicio.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
            gastoMensual.push({
                label: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
                gasto: mesEntradas.reduce((acc, e) => acc + (e.costoTotal || 0), 0),
                cantidad: mesEntradas.reduce((acc, e) => acc + e.cantidad, 0),
                compras: mesEntradas.length
            })
        }

        // Gasto por proveedor
        const porProveedor: Record<string, { nombre: string; gasto: number; cantidad: number; compras: number }> = {}
        for (const e of entradas) {
            const prov = e.proveedor?.nombre || 'Sin proveedor'
            if (!porProveedor[prov]) porProveedor[prov] = { nombre: prov, gasto: 0, cantidad: 0, compras: 0 }
            porProveedor[prov].gasto += (e.costoTotal || 0)
            porProveedor[prov].cantidad += e.cantidad
            porProveedor[prov].compras++
        }

        // Formato de movimientos para la tabla
        const movimientosFormateados = movimientos.map(m => ({
            id: m.id,
            fecha: m.fecha,
            tipo: m.tipo,
            cantidad: m.cantidad,
            costoTotal: m.costoTotal || 0,
            precioUnitario: m.cantidad > 0 && m.costoTotal ? m.costoTotal / m.cantidad : 0,
            factura: m.numeroFactura || '—',
            proveedor: m.proveedor?.nombre || '—',
            ubicacion: m.ubicacion?.nombre || '—',
            estadoPago: m.estadoPago || '—',
            observaciones: m.observaciones || ''
        }))

        return NextResponse.json({
            insumo,
            resumen: {
                totalGastado,
                totalCantidadComprada,
                totalFacturas,
                precioPromedio,
                precioActual: insumo.precioUnitario,
                totalMovimientos: movimientos.length,
                totalEntradas: entradas.length,
                totalSalidas: salidas.length
            },
            movimientos: movimientosFormateados,
            evolucionPrecios,
            gastoMensual,
            porProveedor: Object.values(porProveedor).sort((a, b) => b.gasto - a.gasto)
        })
    } catch (error) {
        console.error('Error obteniendo historial de insumo:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
