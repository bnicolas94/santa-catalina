export interface VinculosMovimientoCaja {
    concepto?: string | null
    liquidacionSueldoId?: string | null
    liquidacionFinalId?: string | null
    prestamoId?: string | null
    cuotaPrestamoId?: string | null
    pagoCierreMensualId?: string | null
}

export function esMovimientoGestionadoPorRRHH(movimiento: VinculosMovimientoCaja): boolean {
    return Boolean(
        movimiento.liquidacionSueldoId
        || movimiento.liquidacionFinalId
        || movimiento.prestamoId
        || movimiento.cuotaPrestamoId
        || movimiento.pagoCierreMensualId
        // Las liquidaciones finales históricas no guardaban FK al movimiento.
        || movimiento.concepto?.toUpperCase() === 'LIQUIDACION_FINAL',
    )
}

export function validarMotivoReasignacionCaja(motivoInformado: unknown): string {
    if (typeof motivoInformado !== 'string') {
        throw new Error('Indicá el motivo de la corrección de caja.')
    }
    const motivo = motivoInformado.trim()
    if (motivo.length < 10 || motivo.length > 500) {
        throw new Error('El motivo de la corrección debe tener entre 10 y 500 caracteres.')
    }
    return motivo
}
