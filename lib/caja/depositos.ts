export function redondearMonto(monto: number): number {
    return Math.round((monto + Number.EPSILON) * 100) / 100
}

export function validarMontoDeposito(valor: unknown, permitirCero = false): number {
    const monto = typeof valor === 'number' ? valor : Number(valor)
    if (!Number.isFinite(monto) || monto < 0 || (!permitirCero && monto === 0)) {
        throw new Error(permitirCero ? 'El monto real debe ser cero o mayor.' : 'El monto declarado debe ser mayor a cero.')
    }
    return redondearMonto(monto)
}

export function calcularDiferenciaDeposito(montoDeclarado: number, montoReal: number): number {
    return redondearMonto(montoReal - montoDeclarado)
}

export function validarObservacionesDiferencia(diferencia: number, observaciones: unknown): string | null {
    const texto = typeof observaciones === 'string' ? observaciones.trim() : ''
    if (diferencia !== 0 && texto.length < 5) {
        throw new Error('Indicá una observación de al menos 5 caracteres para explicar la diferencia.')
    }
    return texto || null
}
