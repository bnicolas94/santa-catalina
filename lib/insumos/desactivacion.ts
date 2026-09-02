type StockUbicacion = {
    cantidad: number
    cantidadSecundaria: number
}

type InsumoParaDesactivar = {
    stockActual: number
    stockActualSecundario: number
    stocks: StockUbicacion[]
    cantidadFichasTecnicas: number
}

const TOLERANCIA_STOCK = 0.0001

export function motivoBloqueoDesactivacion(insumo: InsumoParaDesactivar): string | null {
    const tieneStock = Math.abs(insumo.stockActual) > TOLERANCIA_STOCK
        || Math.abs(insumo.stockActualSecundario) > TOLERANCIA_STOCK
        || insumo.stocks.some(stock => (
            Math.abs(stock.cantidad) > TOLERANCIA_STOCK
            || Math.abs(stock.cantidadSecundaria) > TOLERANCIA_STOCK
        ))
    if (tieneStock) {
        return 'No se puede desactivar un insumo con stock. Ajustá el stock a cero o usá Unificar.'
    }
    if (insumo.cantidadFichasTecnicas > 0) {
        return 'No se puede desactivar porque está incluido en una ficha técnica. Reemplazalo o quitá esa relación primero.'
    }
    return null
}
