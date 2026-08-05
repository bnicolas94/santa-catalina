export interface InasistenciaSeleccionable {
    tipo: string
}

export function novedadRRHHBloqueaSeguimientoGuardado(tipo: string | null | undefined): boolean {
    return !!tipo && tipo !== 'TRABAJO' && tipo !== 'INJUSTIFICADA'
}

function prioridadInasistencia(tipo: string): number {
    if (tipo === 'VACACIONES') return 100
    if (tipo === 'JUSTIFICADA_PAGA') return 90
    if (tipo === 'JUSTIFICADA_NO_PAGA') return 80
    if (tipo === 'JUSTIFICADA') return 70
    if (tipo === 'FRANCO' || tipo === 'FERIADO' || tipo === 'TRABAJO') return 60
    if (tipo === 'CON_AVISO_INJUSTIFICADA') return 20
    if (tipo === 'INJUSTIFICADA') return 10
    return 50
}

/**
 * Evita que una ausencia automática injustificada prevalezca sobre una
 * licencia cargada manualmente cuando existen registros históricos duplicados.
 */
export function seleccionarInasistenciaPreferida<T extends InasistenciaSeleccionable>(
    registros: readonly T[],
): T | undefined {
    return registros.reduce<T | undefined>((seleccionada, actual) => {
        if (!seleccionada) return actual
        return prioridadInasistencia(actual.tipo) > prioridadInasistencia(seleccionada.tipo)
            ? actual
            : seleccionada
    }, undefined)
}
