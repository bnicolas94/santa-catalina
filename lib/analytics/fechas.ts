import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export function periodoAnalyticsValido(desde: string, hasta: string): boolean {
    try {
        return validarFechaCivilRRHH(desde) <= validarFechaCivilRRHH(hasta)
    } catch {
        return false
    }
}

export function periodoMesActual(fecha = new Date()): { desde: string; hasta: string } {
    const anio = fecha.getFullYear()
    const mes = fecha.getMonth()
    const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
    const primerDiaSiguiente = mes === 11 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 2).padStart(2, '0')}-01`
    return { desde, hasta: sumarDiasRRHH(primerDiaSiguiente, -1) }
}

export function periodoSemanaActual(fecha = new Date()): { desde: string; hasta: string } {
    const base = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
    const desplazamiento = fecha.getDay() === 0 ? -6 : 1 - fecha.getDay()
    const desde = sumarDiasRRHH(base, desplazamiento)
    return { desde, hasta: sumarDiasRRHH(desde, 6) }
}
