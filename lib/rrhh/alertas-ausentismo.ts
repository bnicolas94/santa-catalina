export class AlertaAusentismoValidationError extends Error {}

export function normalizarReglaAusentismo(input: Record<string, unknown>) {
    const tipoInasistencia = String(input.tipoInasistencia || '').trim().toUpperCase()
    const limiteMaximo = Number(input.limiteMaximo)
    const periodoDias = Number(input.periodoDias ?? 30)

    if (!tipoInasistencia) throw new AlertaAusentismoValidationError('El tipo de falta es obligatorio.')
    if (!Number.isInteger(limiteMaximo) || limiteMaximo <= 0) {
        throw new AlertaAusentismoValidationError('El límite debe ser un número entero mayor a cero.')
    }
    if (!Number.isInteger(periodoDias) || periodoDias <= 0) {
        throw new AlertaAusentismoValidationError('El período debe ser un número entero mayor a cero.')
    }

    return {
        tipoInasistencia,
        limiteMaximo,
        periodoDias,
        accionSugerida: String(input.accionSugerida || '').trim() || null,
        activo: input.activo !== false,
        autoSancionar: false,
        tipoSancionAuto: null,
    }
}
