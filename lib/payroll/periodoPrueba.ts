import { validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

const INICIO_PERIODO_PRUEBA_SEIS_MESES = '2024-07-09'
const INICIO_SIN_PREAVISO_PERIODO_PRUEBA = '2026-03-06'

function fechaCivil(valor: string | Date) {
    const clave = validarFechaCivilRRHH(
        valor instanceof Date ? valor.toISOString().slice(0, 10) : valor.slice(0, 10),
    )
    const [anio, mes, dia] = clave.split('-').map(Number)
    return new Date(anio, mes - 1, dia, 12)
}

function sumarMeses(fecha: Date, meses: number) {
    const resultado = new Date(fecha)
    const dia = resultado.getDate()
    resultado.setDate(1)
    resultado.setMonth(resultado.getMonth() + meses)
    const ultimoDia = new Date(resultado.getFullYear(), resultado.getMonth() + 1, 0).getDate()
    resultado.setDate(Math.min(dia, ultimoDia))
    return resultado
}

export function antiguedadMesesCompletos(fechaIngreso: string | Date, fechaEgreso: string | Date): number {
    const ingreso = fechaCivil(fechaIngreso)
    const egreso = fechaCivil(fechaEgreso)
    if (egreso < ingreso) return 0
    let meses = (egreso.getFullYear() - ingreso.getFullYear()) * 12 + egreso.getMonth() - ingreso.getMonth()
    if (egreso.getDate() < ingreso.getDate()) meses -= 1
    return Math.max(0, meses)
}

export function esPeriodoPruebaSeisMeses(fechaIngreso: string | Date, fechaEgreso: string | Date): boolean {
    const ingreso = fechaCivil(fechaIngreso)
    const egreso = fechaCivil(fechaEgreso)
    const vigencia = fechaCivil(INICIO_PERIODO_PRUEBA_SEIS_MESES)
    return ingreso >= vigencia && egreso >= ingreso && egreso < sumarMeses(ingreso, 6)
}

export function requierePreavisoEnPeriodoPrueba(fechaEgreso: string | Date): boolean {
    return fechaCivil(fechaEgreso) < fechaCivil(INICIO_SIN_PREAVISO_PERIODO_PRUEBA)
}
