export function cajasPermitidasParaUbicacion(ubicacionTipo: unknown): string[] {
    const tipo = String(ubicacionTipo || '').toUpperCase()
    if (tipo === 'LOCAL') return ['local', 'caja_chica_local']
    if (tipo === 'FABRICA') return ['caja_madre', 'caja_chica']
    return []
}

export function puedeTransferirEntreCajas(ubicacionTipo: unknown, origen: string, destino: string): boolean {
    const permitidas = cajasPermitidasParaUbicacion(ubicacionTipo)
    return permitidas.includes(origen) && permitidas.includes(destino)
}
