import { sumarDiasRRHH } from '@/lib/rrhh/fechas'
import { rangoHistoricoLiquidacion } from './liquidaciones'

interface DatosHorasExtras {
    horasExtras?: unknown
    ajusteHorasExtras?: unknown
    montoHorasExtras?: unknown
    desglose?: unknown
}

function fechaParaMostrar(valor: string): string {
    return valor.split('-').reverse().join('/')
}

export function semanaAnteriorDeLiquidacion(periodo: string, desglose?: unknown) {
    const rango = rangoHistoricoLiquidacion(periodo) || rangoHistoricoLiquidacion(periodo, desglose)
    if (!rango) return null

    const desde = sumarDiasRRHH(rango.desde, -7)
    const hasta = sumarDiasRRHH(rango.hasta, -7)
    return {
        desde,
        hasta,
        etiqueta: `Semana del ${fechaParaMostrar(desde)} al ${fechaParaMostrar(hasta)}`,
    }
}

function numero(valor: unknown): number {
    const resultado = Number(valor)
    return Number.isFinite(resultado) ? resultado : 0
}

function diasDelDesglose(desglose: unknown): Array<Record<string, unknown>> | null {
    if (Array.isArray(desglose)) return desglose as Array<Record<string, unknown>>
    if (!desglose || typeof desglose !== 'object') return null

    const dias = (desglose as Record<string, unknown>).desglosePorDia
    return Array.isArray(dias) ? dias as Array<Record<string, unknown>> : null
}

/**
 * Separa el importe ya persistido de horas extras entre las generadas durante
 * la semana y las cargadas manualmente como ajuste o deuda.
 */
export function separarHorasExtrasYAdeudadas(datos: DatosHorasExtras) {
    const horasExtras = numero(datos.horasExtras)
    const horasAdeudadas = numero(datos.ajusteHorasExtras)
    const montoTotal = numero(datos.montoHorasExtras)

    if (horasAdeudadas === 0) {
        return {
            horasExtras,
            horasAdeudadas: 0,
            montoHorasExtras: montoTotal,
            montoHorasAdeudadas: 0,
        }
    }

    const dias = diasDelDesglose(datos.desglose)
    let montoHorasExtras: number

    if (dias) {
        montoHorasExtras = Math.round(dias.reduce((total, dia) => total + numero(dia.valorExtra), 0))
    } else {
        const horasTotales = horasExtras + horasAdeudadas
        montoHorasExtras = horasTotales === 0
            ? 0
            : Math.round(montoTotal * (horasExtras / horasTotales))
    }

    return {
        horasExtras,
        horasAdeudadas,
        montoHorasExtras,
        montoHorasAdeudadas: montoTotal - montoHorasExtras,
    }
}
