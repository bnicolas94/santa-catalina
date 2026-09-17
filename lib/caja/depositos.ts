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

export class SaldoDepositoInsuficienteError extends Error {
    constructor(public readonly saldoDisponible: number) {
        super(`El depósito supera el saldo disponible de la caja ($${Math.max(0, saldoDisponible).toLocaleString('es-AR')}). Solicitá la autorización de un administrador.`)
        this.name = 'SaldoDepositoInsuficienteError'
    }
}

export function requiereAutorizacionDeposito(monto: number, saldoDisponible: number): boolean {
    return redondearMonto(monto) > redondearMonto(Math.max(0, saldoDisponible))
}

export function exigirSaldoParaDeposito(monto: number, saldoDisponible: number, autorizadoPorAdmin: boolean) {
    if (requiereAutorizacionDeposito(monto, saldoDisponible) && !autorizadoPorAdmin) {
        throw new SaldoDepositoInsuficienteError(saldoDisponible)
    }
}

export function planificarValidacionDeposito(
    montoDeclarado: number,
    montoReal: number,
    tipoMovimientoDeclaracion: string,
) {
    const diferencia = calcularDiferenciaDeposito(montoDeclarado, montoReal)
    const usaSaldoExistente = tipoMovimientoDeclaracion === 'egreso'
    const tipoAjuste = diferencia === 0
        ? null
        : usaSaldoExistente
            ? (diferencia > 0 ? 'egreso' : 'ingreso')
            : (diferencia > 0 ? 'ingreso' : 'egreso')

    return {
        diferencia,
        usaSaldoExistente,
        tipoAjuste: tipoAjuste as 'ingreso' | 'egreso' | null,
        transferirDesdeOrigenAlValidar: !usaSaldoExistente,
    }
}

export function esDeclaracionDepositoConfigurada(input: {
    tipo: unknown
    concepto: unknown
    medioPago: unknown
    cajaOrigen: unknown
}, config: {
    habilitarDeposito: boolean
    conceptoDeposito: string
    cajaDepositoId: string
} | undefined): boolean {
    if (!config?.habilitarDeposito) return false

    return input.tipo === 'ingreso'
        && input.medioPago === 'efectivo'
        && input.concepto === config.conceptoDeposito
        && input.cajaOrigen === config.cajaDepositoId
}

export function validarObservacionesDiferencia(diferencia: number, observaciones: unknown): string | null {
    const texto = typeof observaciones === 'string' ? observaciones.trim() : ''
    if (diferencia !== 0 && texto.length < 5) {
        throw new Error('Indicá una observación de al menos 5 caracteres para explicar la diferencia.')
    }
    return texto || null
}
