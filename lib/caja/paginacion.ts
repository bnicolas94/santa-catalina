export const MOVIMIENTOS_CAJA_POR_PAGINA = 10

export function normalizarPaginacionCaja(paginaSolicitada: unknown, total: number) {
    const paginaNumerica = Number(paginaSolicitada)
    const solicitada = Number.isFinite(paginaNumerica) ? Math.max(1, Math.trunc(paginaNumerica)) : 1
    const totalSeguro = Math.max(0, Math.trunc(total))
    const totalPaginas = Math.max(1, Math.ceil(totalSeguro / MOVIMIENTOS_CAJA_POR_PAGINA))
    const pagina = Math.min(solicitada, totalPaginas)

    return {
        pagina,
        porPagina: MOVIMIENTOS_CAJA_POR_PAGINA,
        total: totalSeguro,
        totalPaginas,
        skip: (pagina - 1) * MOVIMIENTOS_CAJA_POR_PAGINA,
    }
}
