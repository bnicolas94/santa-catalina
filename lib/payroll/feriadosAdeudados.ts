import { etiquetaSemanaOrigen } from '@/lib/payroll/horasExtrasAdeudadas'
import { validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export const TIPO_FERIADO_ADEUDADO = 'FERIADO_ADEUDADO'

export interface DiaLiquidadoFeriado {
    fecha?: unknown
    horasTrabajadas?: unknown
    jornalBase?: unknown
    valorDiaBase?: unknown
    multiplicadorJornal?: unknown
    valorFeriado?: unknown
}

type DesgloseExpress = Record<string, unknown>

function numero(valor: unknown): number {
    const convertido = Number(valor)
    return Number.isFinite(convertido) ? convertido : 0
}

export function diasDeLiquidacion(desglose: unknown): DiaLiquidadoFeriado[] {
    if (Array.isArray(desglose)) return desglose as DiaLiquidadoFeriado[]
    if (!desglose || typeof desglose !== 'object') return []
    const detalle = desglose as Record<string, unknown>
    return Array.isArray(detalle.desglosePorDia)
        ? detalle.desglosePorDia as DiaLiquidadoFeriado[]
        : []
}

export function buscarDiaLiquidado(desglose: unknown, fecha: string): DiaLiquidadoFeriado | null {
    const fechaValidada = validarFechaCivilRRHH(fecha)
    return diasDeLiquidacion(desglose).find(dia => String(dia.fecha || '').slice(0, 10) === fechaValidada) || null
}

export function esLiquidacionExpress(desglose: unknown): desglose is DesgloseExpress {
    return Boolean(desglose)
        && typeof desglose === 'object'
        && !Array.isArray(desglose)
        && String((desglose as DesgloseExpress).origen || '') === 'LIQUIDACION_EXPRESS'
}

export function construirDiaFeriadoExpress(
    desglose: unknown,
    fecha: string,
    horasTrabajadas: number,
    jornalConfigurado: number,
    montoFeriadoOriginal: number = 0,
): DiaLiquidadoFeriado | null {
    if (!esLiquidacionExpress(desglose) || !Number.isFinite(horasTrabajadas) || horasTrabajadas <= 0) return null

    const jornalSnapshot = numero(desglose.jornalDiarioSnapshot)
    const jornalBase = jornalSnapshot > 0 ? jornalSnapshot : numero(jornalConfigurado)
    if (jornalBase <= 0) return null

    return {
        fecha: validarFechaCivilRRHH(fecha),
        horasTrabajadas,
        jornalBase,
        valorDiaBase: jornalBase,
        multiplicadorJornal: 1,
        valorFeriado: numero(montoFeriadoOriginal),
    }
}

export function calcularAdicionalFeriadoAdeudado(dia: DiaLiquidadoFeriado): number {
    const horasTrabajadas = numero(dia.horasTrabajadas)
    if (horasTrabajadas <= 0) {
        throw new Error('El empleado no tiene horas trabajadas registradas en ese feriado.')
    }
    if (numero(dia.valorFeriado) > 0) {
        throw new Error('El adicional de ese feriado ya fue incluido en la liquidación original.')
    }

    const multiplicador = numero(dia.multiplicadorJornal)
    const jornalBase = numero(dia.jornalBase) > 0
        ? numero(dia.jornalBase)
        : multiplicador > 0
            ? numero(dia.valorDiaBase) / multiplicador
            : 0
    if (!Number.isFinite(jornalBase) || jornalBase <= 0) {
        throw new Error('La liquidación original no contiene un jornal válido para calcular el feriado.')
    }

    // Es exactamente la regla usada por la liquidación semanal: el recargo de
    // feriado equivale al 50 % del jornal completo, independientemente de una
    // entrada tardía, siempre que haya existido trabajo real ese día.
    return Math.round(jornalBase * 0.5)
}

export function periodoFeriadoAdeudado(fecha: string, nombreFeriado: string): string {
    return `Pago de feriado adeudado · ${nombreFeriado} · ${etiquetaSemanaOrigen(fecha)}`
}
