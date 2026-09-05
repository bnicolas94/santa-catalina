import type { AdicionalLiquidacionUI, DiaLiquidacionUI, ResultadoLiquidacionUI } from './weeklyPayroll.types'

export interface AlertaLiquidacionUI {
    nivel: 'error' | 'warning'
    mensaje: string
    fecha?: string
}

export function recalcularDiaPorHoras(
    dia: DiaLiquidacionUI,
    horasTrabajadas: number,
    horasJornada: number,
    valorHoraExtra: number,
): DiaLiquidacionUI {
    const horas = Math.max(0, Math.min(24, horasTrabajadas))
    const jornada = horasJornada > 0 ? horasJornada : 8
    const horasNormales = Math.min(horas, jornada)
    const horasExtras = Math.round(Math.max(0, horas - jornada) * 2) / 2
    const multiplicadorJornal = Math.min(1, horasNormales / jornada)
    const valorDiaBase = Math.round(dia.jornalBase * multiplicadorJornal)
    const valorExtra = Math.round(horasExtras * valorHoraExtra)
    const valorFeriado = dia.esFeriado && horas > 0
        ? Math.round(dia.jornalBase * 0.5)
        : 0

    return {
        ...dia,
        horasTrabajadas: Number(horas.toFixed(2)),
        horasExtras,
        multiplicadorJornal,
        valorDiaBase,
        valorExtra,
        valorFeriado,
        totalDia: valorDiaBase + valorExtra + valorFeriado,
        ajusteManual: true,
    }
}

export function recalcularResultado(resultado: ResultadoLiquidacionUI): ResultadoLiquidacionUI {
    const resumen = resumirDesglose(resultado.desglosePorDia)
    const montoHorasExtras = resumen.montoHorasExtras
        + Math.round((resultado.ajusteHorasExtras || 0) * resultado.valorHoraExtra)
    const montoAdicionales = sumarAdicionales(resultado.adicionales)
    return {
        ...resultado,
        sueldoBase: resumen.sueldoBase,
        diasTrabajados: resumen.diasTrabajados,
        horasNormales: Number(resultado.desglosePorDia.reduce(
            (total, dia) => total + Math.max(0, dia.horasTrabajadas - dia.horasExtras),
            0,
        ).toFixed(2)),
        horasExtras: resumen.horasExtras,
        montoHorasExtras,
        montoHorasFeriado: resumen.montoHorasFeriado,
        totalNeto: calcularTotalNeto({
            sueldoBase: resumen.sueldoBase,
            montoHorasExtras,
            montoHorasFeriado: resumen.montoHorasFeriado,
            montoAdicionales,
            descuentoPrestamos: resultado.descuentoPrestamos,
        }),
    }
}

export function fusionarRecalculoEmpleado(
    actual: ResultadoLiquidacionUI,
    recalculado: Omit<ResultadoLiquidacionUI, 'adicionales'>,
    fechaActualizada?: string,
): ResultadoLiquidacionUI {
    const desglosePorDia = recalculado.desglosePorDia.map(diaRecalculado => {
        const diaActual = actual.desglosePorDia.find(dia => dia.fecha === diaRecalculado.fecha)
        if (!diaActual) return diaRecalculado

        const esDiaActualizado = fechaActualizada === diaRecalculado.fecha
        if (diaActual.ajusteManual && !esDiaActualizado) return diaActual
        return diaRecalculado
    })

    return recalcularResultado({
        ...recalculado,
        desglosePorDia,
        ajusteHorasExtras: actual.ajusteHorasExtras,
        adicionales: actual.adicionales || [],
        borradorId: actual.borradorId,
        esSeguimientoMensualMixto: actual.esSeguimientoMensualMixto,
        seguimientoGuardado: actual.esSeguimientoMensualMixto
            ? false
            : actual.seguimientoGuardado,
    })
}

export function obtenerAlertasLiquidacion(resultado: ResultadoLiquidacionUI): AlertaLiquidacionUI[] {
    const alertas: AlertaLiquidacionUI[] = []
    if (!Number.isFinite(resultado.totalNeto) || resultado.totalNeto < 0) {
        alertas.push({ nivel: 'error', mensaje: 'El total neto es inválido o negativo.' })
    }

    for (const dia of resultado.desglosePorDia) {
        const tieneEntrada = parseTimeToMinutes(dia.entrada) !== null
        const tieneSalida = parseTimeToMinutes(dia.salida) !== null
        if (tieneEntrada !== tieneSalida) {
            alertas.push({ nivel: 'error', fecha: dia.fecha, mensaje: 'La jornada tiene una entrada o salida incompleta.' })
            continue
        }
        if (!Number.isFinite(dia.horasTrabajadas) || dia.horasTrabajadas < 0 || dia.horasTrabajadas > 24) {
            alertas.push({ nivel: 'error', fecha: dia.fecha, mensaje: 'Las horas reales están fuera del rango permitido.' })
        }
        if (dia.ajusteManual && tieneEntrada && tieneSalida) {
            const entrada = parseTimeToMinutes(dia.entrada)
            const salida = parseTimeToMinutes(dia.salida)
            if (entrada !== null && salida !== null) {
                const minutosMarcados = salida >= entrada ? salida - entrada : salida + 1440 - entrada
                const horasMarcadas = minutosMarcados / 60
                if (Math.abs(horasMarcadas - dia.horasTrabajadas) > 0.02) {
                    alertas.push({ nivel: 'warning', fecha: dia.fecha, mensaje: `Horas ajustadas (${dia.horasTrabajadas} h) distintas de las marcas (${Number(horasMarcadas.toFixed(2))} h).` })
                }
            }
        }
    }
    return alertas
}

export function resumirDesglose(dias: DiaLiquidacionUI[]) {
    return dias.reduce((resumen, dia) => ({
        sueldoBase: resumen.sueldoBase + dia.valorDiaBase,
        horasExtras: resumen.horasExtras + dia.horasExtras,
        montoHorasExtras: resumen.montoHorasExtras + dia.valorExtra,
        montoHorasFeriado: resumen.montoHorasFeriado + dia.valorFeriado,
        diasTrabajados: resumen.diasTrabajados + (dia.multiplicadorJornal > 0 ? 1 : 0),
    }), {
        sueldoBase: 0,
        horasExtras: 0,
        montoHorasExtras: 0,
        montoHorasFeriado: 0,
        diasTrabajados: 0,
    })
}

export function sumarAdicionales(adicionales: AdicionalLiquidacionUI[]): number {
    return adicionales.reduce((total, adicional) => total + adicional.montoCalculado, 0)
}

export function calcularTotalNeto(input: {
    sueldoBase: number
    montoHorasExtras: number
    montoHorasFeriado: number
    montoAdicionales?: number
    descuentoPrestamos: number
}): number {
    return input.sueldoBase
        + input.montoHorasExtras
        + input.montoHorasFeriado
        + (input.montoAdicionales || 0)
        - input.descuentoPrestamos
}

export function parseTimeToMinutes(timeStr: string | null): number | null {
    if (!timeStr) return null

    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/)
    if (match24) {
        const horas = Number(match24[1])
        const minutos = Number(match24[2])
        return horas <= 23 && minutos <= 59 ? horas * 60 + minutos : null
    }

    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match12) return null

    let horas = Number(match12[1])
    const minutos = Number(match12[2])
    if (horas < 1 || horas > 12 || minutos > 59) return null
    if (match12[3].toUpperCase() === 'PM' && horas !== 12) horas += 12
    if (match12[3].toUpperCase() === 'AM' && horas === 12) horas = 0
    return horas * 60 + minutos
}

export function minutesToTimeDisplay(minutosTotales: number): string {
    const normalizados = ((Math.round(minutosTotales) % 1440) + 1440) % 1440
    const horas24 = Math.floor(normalizados / 60)
    const minutos = normalizados % 60
    const periodo = horas24 >= 12 ? 'PM' : 'AM'
    const horas12 = horas24 === 0 ? 12 : horas24 > 12 ? horas24 - 12 : horas24
    return `${String(horas12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${periodo}`
}

export function toTimeInputValue(timeStr: string | null): string {
    const minutosTotales = parseTimeToMinutes(timeStr)
    if (minutosTotales === null) return ''
    const horas = Math.floor(minutosTotales / 60)
    const minutos = minutosTotales % 60
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}
