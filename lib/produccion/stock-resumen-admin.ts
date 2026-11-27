import { normalizarTexto } from '@/lib/google-sheets-caja'

export type DimensionStockAdmin = {
    productoId: string
    presentacionId: string
    codigoInterno: string
    producto: string
    presentacion: number
    ubicacionId: string
    ubicacion: string
    ubicacionTipo: string
}
export type MovimientoStockAdmin = {
    productoId: string
    presentacionId: string
    ubicacionId: string
    cantidad: number
}

export type VentaStockAdmin = MovimientoStockAdmin & {
    modalidad: string
}

export type ItemStockAdmin = DimensionStockAdmin & {
    disponible: number
    producido: number
    vendidoLocal: number
    vendidoDelivery: number
    vendidoTotal: number
    balanceDia: number
}

function clave(item: Pick<DimensionStockAdmin, 'productoId' | 'presentacionId' | 'ubicacionId'>) {
    return `${item.productoId}|${item.presentacionId}|${item.ubicacionId}`
}

export function esVentaDelivery(modalidad: string) {
    return normalizarTexto(modalidad) === 'delivery'
}

export function construirItemsStockAdmin(
    dimensiones: DimensionStockAdmin[],
    stocks: MovimientoStockAdmin[],
    produccion: MovimientoStockAdmin[],
    ventas: VentaStockAdmin[],
): ItemStockAdmin[] {
    const sumar = <T extends MovimientoStockAdmin>(items: T[]) => {
        const totales = new Map<string, number>()
        for (const item of items) totales.set(clave(item), (totales.get(clave(item)) || 0) + item.cantidad)
        return totales
    }
    const stockPorClave = sumar(stocks)
    const produccionPorClave = sumar(produccion)
    const ventasLocal = sumar(ventas.filter(item => !esVentaDelivery(item.modalidad)))
    const ventasDelivery = sumar(ventas.filter(item => esVentaDelivery(item.modalidad)))

    return dimensiones.map(dimension => {
        const key = clave(dimension)
        const vendidoLocal = ventasLocal.get(key) || 0
        const vendidoDelivery = ventasDelivery.get(key) || 0
        const producido = produccionPorClave.get(key) || 0
        return {
            ...dimension,
            disponible: stockPorClave.get(key) || 0,
            producido,
            vendidoLocal,
            vendidoDelivery,
            vendidoTotal: vendidoLocal + vendidoDelivery,
            balanceDia: producido - vendidoLocal - vendidoDelivery,
        }
    }).filter(item => item.disponible !== 0 || item.producido !== 0 || item.vendidoTotal !== 0)
}
