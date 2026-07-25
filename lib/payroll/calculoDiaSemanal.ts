import { calcularProporcionJornal } from '@/utils/horas'

export interface CalculoDiaSemanalInput {
    horasTrabajadas: number
    horasExtras: number
    horasJornada: number
    jornalBase: number
    valorHora: number
    valorHoraExtra: number
    tieneMarcas: boolean
    esFeriado: boolean
    tipoInasistencia?: string | null
}

export interface CalculoDiaSemanalResultado {
    horasExtras: number
    multiplicadorJornal: number
    valorDiaBase: number
    valorExtra: number
    valorFeriado: number
    totalDia: number
}

/**
 * Calcula los importes de una jornada sin acceder a la base de datos.
 * Mantiene separadas las horas normales del jornal y las horas extras.
 */
export function calcularDiaSemanal(input: CalculoDiaSemanalInput): CalculoDiaSemanalResultado {
    const horasExtras = Math.round(Math.max(0, input.horasExtras) * 2) / 2
    let multiplicadorJornal = 0

    if (input.tieneMarcas) {
        multiplicadorJornal = calcularProporcionJornal(input.horasTrabajadas, input.horasJornada)
    } else if (input.tipoInasistencia === 'JUSTIFICADA_PAGA') {
        multiplicadorJornal = 1
    }

    const valorDiaBase = input.jornalBase * multiplicadorJornal
    const valorExtra = horasExtras * input.valorHoraExtra

    // Regla vigente: si se trabajó un feriado, el recargo se calcula como
    // mínimo sobre una jornada completa, aunque las horas reales sean menores.
    const horasFeriado = input.esFeriado && input.horasTrabajadas > 0
        ? input.horasJornada
        : 0
    const valorFeriado = horasFeriado * input.valorHora * 0.5

    return {
        horasExtras,
        multiplicadorJornal,
        valorDiaBase,
        valorExtra,
        valorFeriado,
        totalDia: valorDiaBase + valorExtra + valorFeriado,
    }
}
