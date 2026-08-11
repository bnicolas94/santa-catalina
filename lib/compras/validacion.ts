export type PagoCajaInput = {
    cajaOrigen: string
    monto: number
}

export type ItemCompraParaPago = {
    id: string
    costoTotal: number | null
    montoPagado: number | null
}

const CENTAVO = 0.01
export const CAJAS_COMPRA = [
    'caja_madre',
    'caja_chica',
    'caja_chica_local',
    'local',
    'mercado_pago',
    'mercado_pago_juani',
] as const

export class CompraValidationError extends Error {}

export function validarCajaCompra(value: unknown): string {
    const caja = String(value || '').trim()
    if (!(CAJAS_COMPRA as readonly string[]).includes(caja)) {
        throw new CompraValidationError('Caja de origen inválida')
    }
    return caja
}

export function numeroPositivo(value: unknown, campo: string): number {
    const parsed = typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number(value)

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new CompraValidationError(`${campo} debe ser un número mayor a 0`)
    }
    return parsed
}

export function numeroNoNegativo(value: unknown, campo: string, fallback = 0): number {
    if (value === undefined || value === null || value === '') return fallback
    const parsed = typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number(value)

    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new CompraValidationError(`${campo} debe ser un número válido mayor o igual a 0`)
    }
    return parsed
}

export function estadoPagoDesdeMontos(total: number, pagado: number): 'pendiente' | 'a_cuenta' | 'pagado' {
    if (total <= CENTAVO || pagado <= CENTAVO) return 'pendiente'
    if (pagado + CENTAVO >= total) return 'pagado'
    return 'a_cuenta'
}

export function validarMontoPagado(total: number, pagado: number): void {
    if (pagado > total + CENTAVO) {
        throw new CompraValidationError('El monto pagado no puede superar el total de la compra')
    }
}

export function validarIdsEdicionCompra(idsOriginales: string[], idsRecibidos: string[]): void {
    if (new Set(idsRecibidos).size !== idsRecibidos.length) {
        throw new CompraValidationError('La factura contiene ítems duplicados')
    }
    const originales = new Set(idsOriginales)
    if (idsRecibidos.some(id => !originales.has(id))) {
        throw new CompraValidationError('Uno de los ítems no pertenece a esta factura')
    }
}

export function distribuirMontoPagadoPorCostos(costos: number[], montoPagado: number): number[] {
    const total = costos.reduce((acc, costo) => acc + costo, 0)
    validarMontoPagado(total, montoPagado)
    let restante = montoPagado
    return costos.map((costo, index) => {
        const asignado = index === costos.length - 1
            ? restante
            : (total > 0 ? montoPagado * (costo / total) : 0)
        restante -= asignado
        return asignado
    })
}

export function validarPagosDivididos(
    pagosRaw: unknown,
    montoEsperado: number,
    cajaOrigenFallback: string
): PagoCajaInput[] {
    if (!Array.isArray(pagosRaw)) {
        return [{ cajaOrigen: validarCajaCompra(cajaOrigenFallback), monto: montoEsperado }]
    }

    const pagos = pagosRaw.map((pago, index) => {
        if (!pago || typeof pago !== 'object') throw new CompraValidationError(`Pago ${index + 1} inválido`)
        const value = pago as Record<string, unknown>
        const cajaOrigen = validarCajaCompra(value.cajaOrigen)
        return { cajaOrigen, monto: numeroPositivo(value.monto, `Monto del pago ${index + 1}`) }
    })

    const suma = pagos.reduce((acc, pago) => acc + pago.monto, 0)
    if (Math.abs(suma - montoEsperado) > CENTAVO) {
        throw new CompraValidationError('La suma de los pagos divididos debe coincidir con el monto abonado')
    }
    return pagos
}

export function distribuirPagoEntreItems(items: ItemCompraParaPago[], monto: number): Map<string, number> {
    const pendientes = items.map(item => ({
        id: item.id,
        saldo: Math.max(0, (item.costoTotal || 0) - (item.montoPagado || 0)),
    })).filter(item => item.saldo > CENTAVO)

    const saldoTotal = pendientes.reduce((acc, item) => acc + item.saldo, 0)
    if (monto > saldoTotal + CENTAVO) throw new CompraValidationError('El pago supera el saldo pendiente de la compra')
    if (monto <= 0) throw new CompraValidationError('El monto a pagar debe ser mayor a 0')

    const result = new Map<string, number>()
    let restante = monto
    pendientes.forEach((item, index) => {
        const esUltimo = index === pendientes.length - 1
        const asignado = esUltimo
            ? Math.min(item.saldo, restante)
            : Math.min(item.saldo, monto * (item.saldo / saldoTotal))
        result.set(item.id, asignado)
        restante -= asignado
    })
    return result
}
