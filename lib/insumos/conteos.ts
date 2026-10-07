const PRECISION_STOCK = 1_000_000

export function parseCantidadConteo(value: unknown): number {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN
    const texto = String(value).trim()
    if (!/^\d+(?:[.,]\d+)?$/.test(texto)) return NaN
    return Number(texto.replace(',', '.'))
}

export function coincideStockConteo(stockActual: number, stockRevisado: number): boolean {
    return Number.isFinite(stockRevisado) && Math.abs(stockActual - stockRevisado) < 0.000001
}

export function cantidadSecundariaParaConteo(
    cantidadContada: number,
    factorConversion: number | null,
    cantidadSecundariaActual: number,
) {
    if (cantidadContada === 0) return 0
    if (!factorConversion || factorConversion <= 0) return cantidadSecundariaActual
    return Math.round((cantidadContada / factorConversion) * PRECISION_STOCK) / PRECISION_STOCK
}
