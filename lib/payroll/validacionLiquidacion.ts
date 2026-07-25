export interface DiaLiquidacionRecibido {
    fecha: string
    horasTrabajadas: number
    horasExtras: number
    jornalBase: number
    valorDiaBase: number
    multiplicadorJornal: number
    valorExtra: number
    valorFeriado: number
}

export interface LiquidacionCalculadaRecibida {
    desglosePorDia: DiaLiquidacionRecibido[]
    ajusteHorasExtras?: number
}

export interface TotalesLiquidacionValidados {
    sueldoBase: number
    horasNormales: number
    horasExtras: number
    montoHorasExtras: number
    montoHorasFeriado: number
    ajusteHorasExtras: number
    diasTrabajados: number
}

function numeroFinito(valor: unknown, campo: string): number {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        throw new Error(`El campo financiero '${campo}' no es un número válido.`)
    }
    return valor
}

function numeroNoNegativo(valor: unknown, campo: string): number {
    const numero = numeroFinito(valor, campo)
    if (numero < 0) throw new Error(`El campo financiero '${campo}' no puede ser negativo.`)
    return numero
}

function aproximadamenteIgual(actual: number, esperado: number, tolerancia = 1): boolean {
    return Math.abs(actual - esperado) <= tolerancia
}

export function reconstruirLiquidacionCalculada(
    data: LiquidacionCalculadaRecibida,
    jornalServidor: number,
    valorHoraExtraServidor: number,
): TotalesLiquidacionValidados {
    if (!data || !Array.isArray(data.desglosePorDia) || data.desglosePorDia.length > 31) {
        throw new Error('El desglose diario de la liquidación es inválido.')
    }

    const jornalEsperado = Math.round(numeroNoNegativo(jornalServidor, 'jornalServidor'))
    const valorExtraEsperado = numeroNoNegativo(valorHoraExtraServidor, 'valorHoraExtraServidor')
    let sueldoBase = 0
    let horasNormales = 0
    let horasExtras = 0
    let montoHorasExtrasBase = 0
    let montoHorasFeriado = 0
    let diasTrabajados = 0

    for (const [indice, dia] of data.desglosePorDia.entries()) {
        if (!dia || typeof dia.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia.fecha)) {
            throw new Error(`La fecha del día ${indice + 1} es inválida.`)
        }

        const jornal = numeroNoNegativo(dia.jornalBase, `desglose[${indice}].jornalBase`)
        const multiplicador = numeroNoNegativo(dia.multiplicadorJornal, `desglose[${indice}].multiplicadorJornal`)
        const valorDia = numeroNoNegativo(dia.valorDiaBase, `desglose[${indice}].valorDiaBase`)
        const horasDia = numeroNoNegativo(dia.horasTrabajadas, `desglose[${indice}].horasTrabajadas`)
        const extrasDia = numeroNoNegativo(dia.horasExtras, `desglose[${indice}].horasExtras`)
        const valorExtra = numeroNoNegativo(dia.valorExtra, `desglose[${indice}].valorExtra`)
        const valorFeriado = numeroNoNegativo(dia.valorFeriado, `desglose[${indice}].valorFeriado`)

        if (horasDia > 24 || extrasDia > 24) {
            throw new Error(`Las horas informadas para el día ${dia.fecha} exceden el límite diario.`)
        }
        if (!aproximadamenteIgual(jornal, jornalEsperado) || multiplicador > 1) {
            throw new Error(`El jornal del día ${dia.fecha} no coincide con la configuración del empleado.`)
        }
        if (!aproximadamenteIgual(valorDia, Math.round(jornalEsperado * multiplicador))) {
            throw new Error(`El importe base del día ${dia.fecha} es inconsistente.`)
        }
        if (!aproximadamenteIgual(valorExtra, Math.round(extrasDia * valorExtraEsperado))) {
            throw new Error(`El importe de horas extras del día ${dia.fecha} es inconsistente.`)
        }
        if (valorFeriado > jornalEsperado) {
            throw new Error(`El importe feriado del día ${dia.fecha} supera el jornal permitido.`)
        }

        sueldoBase += valorDia
        horasNormales += Math.max(0, horasDia - extrasDia)
        horasExtras += extrasDia
        montoHorasExtrasBase += valorExtra
        montoHorasFeriado += valorFeriado
        if (multiplicador > 0) diasTrabajados++
    }

    const ajusteHorasExtras = numeroFinito(data.ajusteHorasExtras ?? 0, 'ajusteHorasExtras')
    if (Math.abs(ajusteHorasExtras) > 168) throw new Error('El ajuste de horas extras excede el límite permitido.')
    const montoHorasExtras = montoHorasExtrasBase + Math.round(ajusteHorasExtras * valorExtraEsperado)
    if (montoHorasExtras < 0) throw new Error('El ajuste genera un importe de horas extras negativo.')

    return {
        sueldoBase,
        horasNormales: Number(horasNormales.toFixed(2)),
        horasExtras,
        montoHorasExtras,
        montoHorasFeriado,
        ajusteHorasExtras,
        diasTrabajados,
    }
}

export function validarMontoAdicional(monto: unknown): number {
    const valor = numeroFinito(monto, 'montoCalculado')
    if (Math.abs(valor) > 100_000_000) throw new Error('El concepto adicional excede el límite permitido.')
    return valor
}
