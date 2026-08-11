export class UnificacionInsumoError extends Error {}

export type StockOrigen = {
    ubicacionId: string
    cantidad: number
    cantidadSecundaria: number
}

const TOLERANCIA = 0.000001

export function prepararTransferenciaStock(
    stockGlobal: number,
    stockSecundarioGlobal: number,
    stocks: StockOrigen[],
    factorPrimario: number,
    factorSecundario: number
) {
    if (!Number.isFinite(factorPrimario) || factorPrimario <= 0) {
        throw new UnificacionInsumoError('La equivalencia hacia la unidad principal debe ser mayor a cero')
    }
    if (!Number.isFinite(factorSecundario) || factorSecundario < 0) {
        throw new UnificacionInsumoError('La equivalencia hacia la unidad secundaria no es válida')
    }
    if (stockGlobal < 0 || stockSecundarioGlobal < 0 || stocks.some(stock => stock.cantidad < 0 || stock.cantidadSecundaria < 0)) {
        throw new UnificacionInsumoError('El duplicado tiene stock negativo y debe conciliarse antes de unificar')
    }

    const totalUbicaciones = stocks.reduce((total, stock) => total + stock.cantidad, 0)
    const totalSecundarioUbicaciones = stocks.reduce((total, stock) => total + stock.cantidadSecundaria, 0)
    if (Math.abs(totalUbicaciones - stockGlobal) > TOLERANCIA || Math.abs(totalSecundarioUbicaciones - stockSecundarioGlobal) > TOLERANCIA) {
        throw new UnificacionInsumoError('El stock global del duplicado no coincide con sus ubicaciones; primero debe conciliarse mediante Conteos')
    }

    return stocks.map(stock => ({
        ...stock,
        cantidadDestino: stock.cantidad * factorPrimario,
        cantidadSecundariaDestino: stock.cantidad * factorSecundario,
    }))
}
