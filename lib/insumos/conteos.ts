const PRECISION_STOCK = 1_000_000

export function cantidadSecundariaParaConteo(
    cantidadContada: number,
    factorConversion: number | null,
    cantidadSecundariaActual: number,
) {
    if (cantidadContada === 0) return 0
    if (!factorConversion || factorConversion <= 0) return cantidadSecundariaActual
    return Math.round((cantidadContada / factorConversion) * PRECISION_STOCK) / PRECISION_STOCK
}
