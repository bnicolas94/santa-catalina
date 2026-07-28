import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export const MODALIDAD_MENSUAL_MIXTA = 'MENSUAL_MIXTA'
export const MODALIDAD_SEMANAL_EFECTIVO = 'SEMANAL_EFECTIVO'

export type MedioPagoMixto = 'TRANSFERENCIA' | 'EFECTIVO'

export function rangoMesLiquidacion(periodo: string): { desde: string; hasta: string } {
    if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('El período mensual es inválido.')
    const [anio, mes] = periodo.split('-').map(Number)
    if (mes < 1 || mes > 12) throw new Error('El período mensual es inválido.')
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const desde = validarFechaCivilRRHH(`${periodo}-01`)
    const hasta = validarFechaCivilRRHH(`${periodo}-${String(ultimoDia).padStart(2, '0')}`)
    return { desde, hasta }
}

export function periodoMensualCerrable(periodo: string, fechaActual: string): boolean {
    const { hasta } = rangoMesLiquidacion(periodo)
    return hasta < validarFechaCivilRRHH(fechaActual)
}

export function calcularDistribucionMixta(totalInformado: unknown, netoReciboInformado: unknown) {
    const totalDevengado = Math.round(Number(totalInformado) * 100) / 100
    const transferencia = Math.round(Number(netoReciboInformado) * 100) / 100
    if (!Number.isFinite(totalDevengado) || totalDevengado <= 0) {
        throw new Error('El total devengado debe ser mayor a cero.')
    }
    if (!Number.isFinite(transferencia) || transferencia < 0) {
        throw new Error('El neto del recibo no puede ser negativo.')
    }
    if (transferencia - totalDevengado > 0.009) {
        throw new Error('El neto del recibo supera el sueldo real calculado. Revisá el cierre antes de continuar.')
    }
    return {
        totalDevengado,
        transferencia,
        efectivo: Math.round((totalDevengado - transferencia) * 100) / 100,
    }
}

export function montoPorMedio(
    distribucion: ReturnType<typeof calcularDistribucionMixta>,
    medio: MedioPagoMixto,
): number {
    return medio === 'TRANSFERENCIA' ? distribucion.transferencia : distribucion.efectivo
}

export function estadoCierreDesdePagos(
    distribucion: ReturnType<typeof calcularDistribucionMixta>,
    pagos: Array<{ medio: string; monto: number; estado?: string }>,
): 'PENDIENTE' | 'PARCIAL' | 'PAGADO' {
    const pagosVigentes = pagos.filter(pago => pago.estado !== 'ANULADO')
    const requerido = (['TRANSFERENCIA', 'EFECTIVO'] as MedioPagoMixto[])
        .filter(medio => montoPorMedio(distribucion, medio) > 0)
    const cubiertos = requerido.filter(medio => {
        const pagado = pagosVigentes
            .filter(pago => pago.medio === medio)
            .reduce((total, pago) => total + pago.monto, 0)
        return Math.abs(pagado - montoPorMedio(distribucion, medio)) <= 0.009
    })
    if (cubiertos.length === requerido.length) return 'PAGADO'
    return pagosVigentes.length > 0 ? 'PARCIAL' : 'PENDIENTE'
}

export function periodoSiguiente(periodo: string): string {
    const { hasta } = rangoMesLiquidacion(periodo)
    return sumarDiasRRHH(hasta, 1).slice(0, 7)
}
