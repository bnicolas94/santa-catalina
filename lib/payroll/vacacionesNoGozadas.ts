import { validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

function claveFechaCivil(valor: string | Date) {
    return validarFechaCivilRRHH(
        valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.slice(0, 10),
    )
}

function fechaUtc(valor: string | Date) {
    const [anio, mes, dia] = claveFechaCivil(valor).split('-').map(Number)
    return new Date(Date.UTC(anio, mes - 1, dia))
}

function diasDelAnio(anio: number) {
    return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0 ? 366 : 365
}

export interface CalculoVacacionesNoGozadas {
    dias: number
    monto: number
    diasRelacionEnAnio: number
    diasBaseAnual: number
    diasVacacionesAnuales: number
}

export function diasVacacionesAnualesPorAntiguedad(antiguedadAniosCompletos: number) {
    if (antiguedadAniosCompletos > 20) return 35
    if (antiguedadAniosCompletos > 10) return 28
    if (antiguedadAniosCompletos > 5) return 21
    return 14
}

/**
 * Calcula la indemnización del art. 156 LCT sobre la fracción del año
 * efectivamente comprendida por la relación laboral. Nunca computa días
 * anteriores al ingreso ni usa 365 en años bisiestos.
 */
export function calcularVacacionesNoGozadasProporcionales(params: {
    fechaIngreso: string | Date
    fechaEgreso: string | Date
    diasVacacionesAnuales: number
    sueldoMensual: number
}): CalculoVacacionesNoGozadas {
    const ingreso = fechaUtc(params.fechaIngreso)
    const egreso = fechaUtc(params.fechaEgreso)
    const anioEgreso = egreso.getUTCFullYear()
    const inicioAnio = new Date(Date.UTC(anioEgreso, 0, 1))
    const inicioComputable = ingreso > inicioAnio ? ingreso : inicioAnio
    const diasBaseAnual = diasDelAnio(anioEgreso)

    if (egreso < inicioComputable) {
        return {
            dias: 0,
            monto: 0,
            diasRelacionEnAnio: 0,
            diasBaseAnual,
            diasVacacionesAnuales: params.diasVacacionesAnuales,
        }
    }

    const unDia = 24 * 60 * 60 * 1000
    const diasRelacionEnAnio = Math.floor((egreso.getTime() - inicioComputable.getTime()) / unDia) + 1
    const dias = (params.diasVacacionesAnuales / diasBaseAnual) * diasRelacionEnAnio
    const monto = (params.sueldoMensual / 25) * dias

    return {
        dias,
        monto,
        diasRelacionEnAnio,
        diasBaseAnual,
        diasVacacionesAnuales: params.diasVacacionesAnuales,
    }
}
