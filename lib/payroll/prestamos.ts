export const MONTO_MAXIMO_PRESTAMO = 1_000_000_000
export const CUOTAS_MAXIMAS_PRESTAMO = 60

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
