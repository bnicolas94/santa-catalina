import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export interface RangoVacaciones {
    desde: string
    hasta: string
}

export function rangoVacacionesDesdeDesglose(desglose: unknown): RangoVacaciones | null {
    if (!desglose || typeof desglose !== 'object' || Array.isArray(desglose)) return null
    const data = desglose as Record<string, unknown>
    if (typeof data.fechaInicioGoce !== 'string' || typeof data.fechaFinGoce !== 'string') return null

    try {
        const desde = validarFechaCivilRRHH(data.fechaInicioGoce)
        const hasta = validarFechaCivilRRHH(data.fechaFinGoce)
        return desde <= hasta ? { desde, hasta } : null
    } catch {
        return null
    }
}

export function fechasDeRangoVacaciones(desde: string, hasta: string): string[] {
    const inicio = validarFechaCivilRRHH(desde)
    const fin = validarFechaCivilRRHH(hasta)
    if (inicio > fin) throw new Error('El inicio de vacaciones debe ser anterior o igual al fin.')

    const fechas: string[] = []
    for (let actual = inicio; actual <= fin; actual = sumarDiasRRHH(actual, 1)) fechas.push(actual)
    return fechas
}

export function esDiaLaboralConfigurado(configuracion: string | null | undefined, fecha: string): boolean {
    const [anio, mes, dia] = validarFechaCivilRRHH(fecha).split('-').map(Number)
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()
    const normalizada = (configuracion || 'Lunes a Viernes').toLowerCase()

    if (normalizada.includes('todos')) return true
    if (normalizada.includes('lunes a sábado') || normalizada.includes('lunes a sabado')) return diaSemana >= 1 && diaSemana <= 6
    if (normalizada.includes('lunes a viernes')) return diaSemana >= 1 && diaSemana <= 5

    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    return normalizada.includes(nombres[diaSemana]) || (diaSemana === 3 && normalizada.includes('miercoles')) || (diaSemana === 6 && normalizada.includes('sabado'))
}

export function periodoLaboralCubiertoPorVacaciones(
    desde: string,
    hasta: string,
    diasTrabajoSemana: string | null | undefined,
    fechasVacaciones: ReadonlySet<string>,
): boolean {
    const laborales = fechasDeRangoVacaciones(desde, hasta).filter(fecha => esDiaLaboralConfigurado(diasTrabajoSemana, fecha))
    return laborales.length > 0 && laborales.every(fecha => fechasVacaciones.has(fecha))
}
