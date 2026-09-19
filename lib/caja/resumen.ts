export interface MovimientoResumenCaja {
    tipo: string
    concepto: string
    monto: number
    medioPago: string
    depositoIngreso?: unknown
    depositoRecepcion?: unknown
    depositoAjuste?: unknown
    depositoAjusteRecepcion?: unknown
    depositoTransferenciaOrigen?: unknown
    depositoTransferenciaDestino?: unknown
}

const normalizarConcepto = (concepto: string) => concepto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export function esMovimientoInternoCaja(movimiento: MovimientoResumenCaja) {
    const concepto = normalizarConcepto(movimiento.concepto)
    const conceptoInterno = concepto === 'transferencia_interna'
        || concepto.includes('transferencia entre cajas')
        || concepto.includes('transferencias internas')
        || concepto.includes('deposito diario')

    return conceptoInterno || Boolean(
        movimiento.depositoIngreso
        || movimiento.depositoRecepcion
        || movimiento.depositoAjuste
        || movimiento.depositoAjusteRecepcion
        || movimiento.depositoTransferenciaOrigen
        || movimiento.depositoTransferenciaDestino
    )
}

export function calcularResumenCajaExterno(movimientos: MovimientoResumenCaja[]) {
    let ingresosEfectivo = 0
    let ingresosTransferencia = 0
    let egresosTotal = 0

    for (const movimiento of movimientos) {
        if (esMovimientoInternoCaja(movimiento)) continue
        if (movimiento.tipo === 'egreso') egresosTotal += movimiento.monto
        else if (movimiento.tipo === 'ingreso' && movimiento.medioPago === 'efectivo') ingresosEfectivo += movimiento.monto
        else if (movimiento.tipo === 'ingreso') ingresosTransferencia += movimiento.monto
    }

    return {
        ingresosEfectivo,
        ingresosTransferencia,
        egresosTotal,
        saldo: ingresosEfectivo + ingresosTransferencia - egresosTotal,
    }
}
