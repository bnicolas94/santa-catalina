interface MovimientoLiquidacionFinal {
    tipo: string
    monto: number
    cajaOrigen: string | null
    estado: string
    movimientoReversion: { id: string } | null
}

interface CuotaLiquidacionFinal {
    id: string
    monto: number
}

export function validarLiquidacionFinalAnulable(input: {
    estado: string
    totalNeto: number
    totalDescuentos: number
    movimiento: MovimientoLiquidacionFinal | null
    cuotasDescontadas: CuotaLiquidacionFinal[]
}) {
    if (input.estado === 'anulado') throw new Error('La liquidación final ya fue anulada.')
    if (input.estado !== 'pagado') throw new Error('Sólo puede anularse una liquidación final pagada.')

    const movimiento = input.movimiento
    if (input.totalNeto > 0 && !movimiento) {
        throw new Error('La liquidación final no tiene un movimiento de Caja trazable y no puede anularse automáticamente.')
    }
    if (movimiento) {
        if (movimiento.estado !== 'activo' || movimiento.tipo !== 'egreso' || !movimiento.cajaOrigen) {
            throw new Error('El movimiento de Caja de la liquidación final no es válido para revertir.')
        }
        if (Math.abs(movimiento.monto - input.totalNeto) > 0.009) {
            throw new Error('El importe de Caja no coincide con el neto de la liquidación final.')
        }
        if (movimiento.movimientoReversion) {
            throw new Error('El movimiento de Caja de la liquidación final ya fue revertido.')
        }
    }

    if (input.totalDescuentos > 0) {
        if (input.cuotasDescontadas.length === 0) {
            throw new Error('Esta liquidación final tiene descuentos históricos sin cuotas identificadas. Requiere revisión manual.')
        }
        const totalCuotas = input.cuotasDescontadas.reduce((total, cuota) => total + cuota.monto, 0)
        if (Math.abs(totalCuotas - input.totalDescuentos) > 0.009) {
            throw new Error('Las cuotas vinculadas no coinciden con los descuentos de la liquidación final.')
        }
    }
}
