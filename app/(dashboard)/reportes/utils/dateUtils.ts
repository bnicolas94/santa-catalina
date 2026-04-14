/**
 * Utilidades de fechas para el módulo de reportes.
 * Soporta granularidad: día, semana, mes, rango personalizado.
 */

export type GranularidadTemporal = 'dia' | 'semana' | 'mes' | 'rango'

export interface RangoFechas {
    desde: Date
    hasta: Date
    label: string
}

/**
 * Calcula el rango de fechas según la granularidad seleccionada.
 */
export function getDateRange(
    granularidad: GranularidadTemporal,
    opciones: {
        mes?: number
        anio?: number
        fecha?: string       // YYYY-MM-DD para 'dia'
        semanaOffset?: number // 0 = semana actual, -1 = anterior, etc.
        rangoDesde?: string   // YYYY-MM-DD
        rangoHasta?: string   // YYYY-MM-DD
    } = {}
): RangoFechas {
    const now = new Date()
    const mes = opciones.mes ?? now.getMonth() + 1
    const anio = opciones.anio ?? now.getFullYear()

    switch (granularidad) {
        case 'dia': {
            const fecha = opciones.fecha ? new Date(opciones.fecha + 'T00:00:00') : now
            const desde = new Date(fecha)
            desde.setHours(0, 0, 0, 0)
            const hasta = new Date(fecha)
            hasta.setHours(23, 59, 59, 999)
            return {
                desde,
                hasta,
                label: fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
            }
        }
        case 'semana': {
            const offset = opciones.semanaOffset ?? 0
            const ref = opciones.fecha ? new Date(opciones.fecha + 'T00:00:00') : new Date(now)
            
            if (offset !== 0) {
                ref.setDate(ref.getDate() + (offset * 7))
            }
            
            const dayOfWeek = ref.getDay()
            const monday = new Date(ref)
            monday.setDate(ref.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
            monday.setHours(0, 0, 0, 0)
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            sunday.setHours(23, 59, 59, 999)
            return {
                desde: monday,
                hasta: sunday,
                label: `Semana del ${monday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} al ${sunday.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
        }
        case 'mes': {
            const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0)
            const hasta = new Date(anio, mes, 0, 23, 59, 59, 999)
            const nombreMes = desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
            return { desde, hasta, label: nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) }
        }
        case 'rango': {
            const desde = opciones.rangoDesde
                ? new Date(opciones.rangoDesde + 'T00:00:00')
                : new Date(anio, mes - 1, 1, 0, 0, 0, 0)
            const hasta = opciones.rangoHasta
                ? new Date(opciones.rangoHasta + 'T23:59:59.999')
                : new Date(anio, mes, 0, 23, 59, 59, 999)
            return {
                desde,
                hasta,
                label: `${desde.toLocaleDateString('es-AR')} — ${hasta.toLocaleDateString('es-AR')}`
            }
        }
        default:
            return getDateRange('mes', opciones)
    }
}

/**
 * Dado un rango, devuelve el rango del período anterior equivalente.
 * Ej: si el rango es un mes, devuelve el mes anterior.
 */
export function getPeriodoAnterior(rango: RangoFechas): RangoFechas {
    const diffMs = rango.hasta.getTime() - rango.desde.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const hasta = new Date(rango.desde)
    hasta.setDate(hasta.getDate() - 1)
    hasta.setHours(23, 59, 59, 999)

    const desde = new Date(hasta)
    desde.setDate(desde.getDate() - diffDays + 1)
    desde.setHours(0, 0, 0, 0)

    return {
        desde,
        hasta,
        label: `${desde.toLocaleDateString('es-AR')} — ${hasta.toLocaleDateString('es-AR')}`
    }
}

/**
 * Divide un rango en sub-períodos para gráficos de tendencia.
 */
export function dividirEnSubperiodos(
    rango: RangoFechas,
    cantidad: number = 4
): { desde: Date; hasta: Date; label: string }[] {
    const diffMs = rango.hasta.getTime() - rango.desde.getTime()
    const stepMs = diffMs / cantidad
    const periodos = []

    for (let i = 0; i < cantidad; i++) {
        const desde = new Date(rango.desde.getTime() + stepMs * i)
        const hasta = new Date(rango.desde.getTime() + stepMs * (i + 1) - 1)
        periodos.push({
            desde,
            hasta,
            label: desde.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
        })
    }

    return periodos
}

/**
 * Formatea un rango para uso en API query params.
 */
export function rangoToParams(rango: RangoFechas): Record<string, string> {
    return {
        desde: rango.desde.toISOString(),
        hasta: rango.hasta.toISOString()
    }
}

/**
 * Meses del año en español para selectores.
 */
export const MESES = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
]
