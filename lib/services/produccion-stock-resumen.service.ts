import { prisma } from '@/lib/prisma'
import { normalizarTexto } from '@/lib/google-sheets-caja'
import { interpretarPaquetes } from '@/lib/google-sheets-stock'
import { obtenerConfiguracionSheetStock, resumenGoogleSheetsStock } from '@/lib/services/google-sheets-stock.service'
import { obtenerReportePedidosConjunto } from '@/lib/services/reportes-pedidos-conjunto'
import { construirItemsStockAdmin, type DimensionStockAdmin, type MovimientoStockAdmin, type VentaStockAdmin } from '@/lib/produccion/stock-resumen-admin'

const CODIGOS_PRODUCCION = ['JQ', 'CLA', 'ESP']

function fechaProduccionUtc(fecha: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Seleccioná una fecha válida.')
    const [anio, mes, dia] = fecha.split('-').map(Number)
    const resultado = new Date(Date.UTC(anio, mes - 1, dia))
    if (resultado.getUTCFullYear() !== anio || resultado.getUTCMonth() !== mes - 1 || resultado.getUTCDate() !== dia) {
        throw new Error('Seleccioná una fecha válida.')
    }
    return resultado
}
export async function obtenerResumenStockProduccion(fecha: string) {
    const fechaLote = fechaProduccionUtc(fecha)
    const [productos, ubicaciones, stocks, movimientosLote, mapeos, configuracionStock, estadoStock] = await Promise.all([
        prisma.producto.findMany({
            where: { activo: true, codigoInterno: { in: CODIGOS_PRODUCCION } },
            include: { presentaciones: { where: { activo: true }, orderBy: { cantidad: 'desc' } } },
            orderBy: { codigoInterno: 'asc' },
        }),
        prisma.ubicacion.findMany({ where: { activo: true }, select: { id: true, nombre: true, tipo: true }, orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }] }),
        prisma.stockProducto.findMany({
            where: { producto: { codigoInterno: { in: CODIGOS_PRODUCCION } }, presentacion: { activo: true }, ubicacion: { activo: true } },
            select: { productoId: true, presentacionId: true, ubicacionId: true, cantidad: true },
        }),
        prisma.movimientoProducto.findMany({
            where: { lote: { fechaProduccion: fechaLote }, producto: { codigoInterno: { in: CODIGOS_PRODUCCION } } },
            select: { productoId: true, presentacionId: true, ubicacionId: true, cantidad: true, signo: true },
        }),
        prisma.integracionSheetSucursal.findMany({ where: { activo: true }, select: { ubicacionClave: true, ubicacionId: true } }),
        obtenerConfiguracionSheetStock(),
        resumenGoogleSheetsStock(),
    ])

    const dimensiones: DimensionStockAdmin[] = productos.flatMap(producto =>
        producto.presentaciones.flatMap(presentacion => ubicaciones.map(ubicacion => ({
            productoId: producto.id,
            presentacionId: presentacion.id,
            codigoInterno: producto.codigoInterno,
            producto: producto.nombre,
            presentacion: presentacion.cantidad,
            ubicacionId: ubicacion.id,
            ubicacion: ubicacion.nombre,
            ubicacionTipo: ubicacion.tipo,
        }))),
    )
    const produccion: MovimientoStockAdmin[] = movimientosLote.map(movimiento => ({
        productoId: movimiento.productoId,
        presentacionId: movimiento.presentacionId,
        ubicacionId: movimiento.ubicacionId,
        cantidad: movimiento.signo === 'entrada' ? movimiento.cantidad : -movimiento.cantidad,
    }))

    const productosPorCodigoPresentacion = new Map(
        productos.flatMap(producto => producto.presentaciones.map(presentacion => [
            `${producto.codigoInterno}:${presentacion.cantidad}`,
            { productoId: producto.id, presentacionId: presentacion.id },
        ] as const)),
    )
    const fabricaCentral = ubicaciones.find(ubicacion => ubicacion.tipo === 'FABRICA' && normalizarTexto(ubicacion.nombre) === 'central')
        ?? ubicaciones.find(ubicacion => ubicacion.tipo === 'FABRICA')
    const ubicacionPorClave = new Map(mapeos.map(mapeo => [mapeo.ubicacionClave, mapeo.ubicacionId]))
    if (fabricaCentral) ubicacionPorClave.set('fabrica', fabricaCentral.id)

    const ventas: VentaStockAdmin[] = []
    let pedidosEntregados = 0
    let pedidosSinClasificar = 0
    let paquetesSinClasificar = 0
    let ventasActualizadasEn: string | null = null
    let errorVentas: string | null = null
    try {
        const reporte = await obtenerReportePedidosConjunto({ desde: fecha, hasta: fecha, estado: 'Entregado', todos: true })
        ventasActualizadasEn = reporte.actualizado
        for (const pedido of reporte.registros) {
            if (pedido.duplicado || pedido.conflicto || normalizarTexto(pedido.estado) !== 'entregado') continue
            pedidosEntregados++
            const ubicacionId = ubicacionPorClave.get(normalizarTexto(pedido.ubicacion))
            const interpretacion = interpretarPaquetes({ productoTexto: pedido.producto, cantidadTexto: pedido.cantidad })
            if (!ubicacionId || !interpretacion.lineas) {
                pedidosSinClasificar++
                paquetesSinClasificar += pedido.paquetes || 0
                continue
            }
            let pedidoClasificable = true
            const lineas = interpretacion.lineas.flatMap(linea => {
                const referencia = productosPorCodigoPresentacion.get(`${linea.codigo}:${linea.presentacion}`)
                if (!referencia) {
                    pedidoClasificable = false
                    return []
                }
                return [{ ...referencia, ubicacionId, cantidad: linea.paquetes, modalidad: pedido.modalidad }]
            })
            if (!pedidoClasificable) {
                pedidosSinClasificar++
                paquetesSinClasificar += pedido.paquetes || 0
                continue
            }
            ventas.push(...lineas)
        }
    } catch (error) {
        errorVentas = error instanceof Error ? error.message : 'No se pudieron consultar las ventas entregadas.'
    }

    const items = construirItemsStockAdmin(dimensiones, stocks, produccion, ventas)
    const totales = items.reduce((total, item) => ({
        disponible: total.disponible + item.disponible,
        producido: total.producido + item.producido,
        vendidoLocal: total.vendidoLocal + item.vendidoLocal,
        vendidoDelivery: total.vendidoDelivery + item.vendidoDelivery,
        vendidoTotal: total.vendidoTotal + item.vendidoTotal,
        balanceDia: total.balanceDia + item.balanceDia,
    }), { disponible: 0, producido: 0, vendidoLocal: 0, vendidoDelivery: 0, vendidoTotal: 0, balanceDia: 0 })

    return {
        fecha,
        items,
        totales,
        calidad: { pedidosEntregados, pedidosSinClasificar, paquetesSinClasificar, errorVentas },
        sincronizacion: {
            activa: configuracionStock.activo,
            ultimaSincronizacion: estadoStock.estado.ultimaSincronizacion || null,
            error: estadoStock.estado.error || null,
            pendientes: estadoStock.totalPendientes,
            ventasActualizadasEn,
        },
    }
}
