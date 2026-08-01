export const MONTO_MAXIMO_PRESTAMO = 1_000_000_000
export const CUOTAS_MAXIMAS_PRESTAMO = 60
const ORIGENES_SIN_CAJA = new Set(['mercaderia', 'ninguna'])

export type CuotaPrestamoComparable = {
    id: string
    prestamoId: string
    numeroCuota: number
    monto: number
    estado: string
    fechaVencimiento: Date | string
    liquidacionId?: string | null
}

export function validarMontoPrestamo(valor: unknown): number {
    const monto = typeof valor === 'number' ? valor : Number(valor)
    if (!Number.isFinite(monto) || monto <= 0 || monto > MONTO_MAXIMO_PRESTAMO) {
        throw new Error('El monto debe ser mayor a $0 y estar dentro del límite permitido.')
    }
    return Math.round(monto * 100) / 100
}

export function validarCantidadCuotas(valor: unknown): number {
    const cantidad = typeof valor === 'number' ? valor : Number(valor)
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CUOTAS_MAXIMAS_PRESTAMO) {
        throw new Error(`La cantidad de cuotas debe ser un número entero entre 1 y ${CUOTAS_MAXIMAS_PRESTAMO}.`)
    }
    return cantidad
}

export function dividirMontoEnCuotas(monto: number, cantidad: number): number[] {
    const montoValido = validarMontoPrestamo(monto)
    const cantidadValida = validarCantidadCuotas(cantidad)
    const centavos = Math.round(montoValido * 100)
    const base = Math.floor(centavos / cantidadValida)
    const resto = centavos - base * cantidadValida

    return Array.from({ length: cantidadValida }, (_, indice) =>
        (base + (indice === cantidadValida - 1 ? resto : 0)) / 100
    )
}

export function sumarMesesFechaCivil(fecha: string, meses: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(meses)) {
        throw new Error('Fecha de vencimiento inválida.')
    }

    const [anio, mes, dia] = fecha.split('-').map(Number)
    const fechaOriginal = new Date(Date.UTC(anio, mes - 1, dia))
    if (
        fechaOriginal.getUTCFullYear() !== anio
        || fechaOriginal.getUTCMonth() !== mes - 1
        || fechaOriginal.getUTCDate() !== dia
    ) {
        throw new Error('Fecha de vencimiento inválida.')
    }
    const primerDiaDestino = new Date(Date.UTC(anio, mes - 1 + meses, 1))
    const ultimoDiaDestino = new Date(Date.UTC(
        primerDiaDestino.getUTCFullYear(),
        primerDiaDestino.getUTCMonth() + 1,
        0,
    )).getUTCDate()
    const fechaDestino = new Date(Date.UTC(
        primerDiaDestino.getUTCFullYear(),
        primerDiaDestino.getUTCMonth(),
        Math.min(dia, ultimoDiaDestino),
    ))
    return fechaDestino.toISOString().slice(0, 10)
}

export function seleccionarCuotasVencidasPorPrestamo<T extends CuotaPrestamoComparable>(
    cuotas: T[],
    finExclusivo: Date,
): T[] {
    const ordenadas = cuotas
        .filter(cuota =>
            cuota.estado === 'pendiente'
            && !cuota.liquidacionId
            && new Date(cuota.fechaVencimiento).getTime() < finExclusivo.getTime()
        )
        .sort((a, b) => {
            const diferenciaFecha = new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime()
            return diferenciaFecha || a.numeroCuota - b.numeroCuota
        })

    const primeraPorPrestamo = new Map<string, T>()
    for (const cuota of ordenadas) {
        if (!primeraPorPrestamo.has(cuota.prestamoId)) primeraPorPrestamo.set(cuota.prestamoId, cuota)
    }
    return [...primeraPorPrestamo.values()]
}

export function estadoPrestamoDesdeCuotas(cuotas: Array<{ estado: string }>): 'activo' | 'saldado' {
    return cuotas.some(cuota => cuota.estado === 'pendiente') ? 'activo' : 'saldado'
}

export function validarMotivoAnulacionPrestamo(valor: unknown): string {
    const motivo = typeof valor === 'string' ? valor.trim() : ''
    if (motivo.length < 10 || motivo.length > 500) {
        throw new Error('El motivo de anulación debe tener entre 10 y 500 caracteres.')
    }
    return motivo
}

export type PlanCancelacionPrestamo = {
    tipo: 'anulacion_total' | 'cancelacion_saldo'
    cantidadCuotas: number
    monto: number
}

export function planificarCancelacionPrestamo(cuotas: Array<{
    estado: string
    monto: number
    liquidacionId: string | null
}>): PlanCancelacionPrestamo {
    const pendientes = cuotas.filter(cuota => cuota.estado === 'pendiente' && !cuota.liquidacionId)
    if (pendientes.length === 0) {
        throw new Error('El préstamo no tiene cuotas pendientes para cancelar.')
    }

    const tieneCuotasAplicadas = cuotas.some(cuota => cuota.estado === 'pagada' || Boolean(cuota.liquidacionId))
    return {
        tipo: tieneCuotasAplicadas ? 'cancelacion_saldo' : 'anulacion_total',
        cantidadCuotas: pendientes.length,
        monto: Math.round(pendientes.reduce((total, cuota) => total + cuota.monto, 0) * 100) / 100,
    }
}

export function origenRequiereMovimientoCaja(origen: string): boolean {
    return !ORIGENES_SIN_CAJA.has(origen)
}

export function validarPrestamoAnulable(input: {
    estado: string
    origenEntrega: string | null
    cuotas: Array<{ estado: string; liquidacionId: string | null; origenEntrega: string | null }>
    movimientos: Array<{
        tipo: string
        cajaOrigen: string | null
        movimientoReversion: { id: string } | null
    }>
}): void {
    if (input.estado === 'anulado' || input.estado === 'cancelado_saldo') {
        throw new Error('El préstamo ya fue cerrado.')
    }
    if (input.cuotas.some(cuota => cuota.estado === 'pagada' || cuota.liquidacionId)) {
        throw new Error('El préstamo tiene cuotas vinculadas a liquidaciones y no puede anularse.')
    }
    if (!input.origenEntrega) {
        throw new Error('Este préstamo es anterior a la trazabilidad de Caja y no puede anularse automáticamente.')
    }

    const movimientosEsperados = (origenRequiereMovimientoCaja(input.origenEntrega) ? 1 : 0)
        + input.cuotas.filter(cuota => cuota.origenEntrega && origenRequiereMovimientoCaja(cuota.origenEntrega)).length

    if (input.movimientos.length !== movimientosEsperados) {
        throw new Error('Los movimientos de Caja vinculados no coinciden con las entregas del préstamo.')
    }
    if (input.movimientos.some(movimiento => movimiento.tipo !== 'egreso' || !movimiento.cajaOrigen)) {
        throw new Error('El préstamo contiene un movimiento de Caja inválido para revertir.')
    }
    if (input.movimientos.some(movimiento => movimiento.movimientoReversion)) {
        throw new Error('Uno de los movimientos del préstamo ya fue revertido.')
    }
}
