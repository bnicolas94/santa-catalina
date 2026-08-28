export type ConfiguracionJornal = {
    jornal?: number | null
    sueldoBaseMensual?: number | null
    cicloPago?: string | null
    rolRel?: {
        jornal?: number | null
        cicloPago?: string | null
    } | null
}

function positivo(valor: unknown) {
    const numero = Number(valor)
    return Number.isFinite(numero) && numero > 0 ? numero : 0
}

/**
 * Devuelve el jornal diario efectivo respetando la misma prioridad que usa la
 * liquidación semanal: configuración individual, tipo de empleado y mensual.
 */
export function jornalDiarioEfectivo(configuracion: ConfiguracionJornal): number {
    const jornalIndividual = positivo(configuracion.jornal)
    const jornalRol = positivo(configuracion.rolRel?.jornal)
    const sueldoMensual = positivo(configuracion.sueldoBaseMensual)

    const montoBase = jornalIndividual || jornalRol || sueldoMensual
    const ciclo = jornalIndividual
        ? configuracion.cicloPago || 'SEMANAL'
        : jornalRol
            ? configuracion.rolRel?.cicloPago || 'SEMANAL'
            : 'MENSUAL'

    if (ciclo === 'DIARIO') return montoBase
    if (ciclo === 'MENSUAL') return montoBase / 30
    if (ciclo === 'QUINCENAL') return montoBase / 15
    return montoBase / 6
}
