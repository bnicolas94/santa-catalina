export const ZONA_HORARIA_RRHH = 'America/Buenos_Aires'

const OFFSET_RRHH = '-03:00'

const formatoFechaRRHH = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_RRHH,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

export function fechaClaveRRHH(fecha: Date | string): string {
    const date = fecha instanceof Date ? fecha : new Date(fecha)
    if (Number.isNaN(date.getTime())) throw new Error('Fecha inválida')

    const partes = formatoFechaRRHH.formatToParts(date)
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
        partes.find(parte => parte.type === tipo)?.value

    return `${valor('year')}-${valor('month')}-${valor('day')}`
}

export function validarFechaCivilRRHH(fecha: string): string {
    const clave = fecha.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clave)) throw new Error('Fecha de RR. HH. inválida')

    const [anio, mes, dia] = clave.split('-').map(Number)
    const control = new Date(Date.UTC(anio, mes - 1, dia))
    if (control.getUTCFullYear() !== anio || control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
        throw new Error('Fecha de RR. HH. inválida')
    }
    return clave
}

export function sumarDiasRRHH(fecha: string, dias: number): string {
    const clave = validarFechaCivilRRHH(fecha)
    const [anio, mes, dia] = clave.split('-').map(Number)
    return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

export function instanteRRHH(fecha: string, hora = '00:00:00'): Date {
    const clave = validarFechaCivilRRHH(fecha)
    if (!/^\d{2}:\d{2}:\d{2}(?:\.\d{3})?$/.test(hora)) throw new Error('Hora de RR. HH. inválida')
    return new Date(`${clave}T${hora}${OFFSET_RRHH}`)
}

export function rangoDiasRRHH(desde: string, hasta: string): { gte: Date; lt: Date } {
    return { gte: instanteRRHH(desde), lt: instanteRRHH(sumarDiasRRHH(hasta, 1)) }
}

export function rangoDiaRRHH(fecha: string): { gte: Date; lt: Date } {
    return rangoDiasRRHH(fecha, fecha)
}
