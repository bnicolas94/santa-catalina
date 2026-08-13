export function validarMotivoAnulacionCaja(valor: unknown): string {
    if (typeof valor !== 'string') throw new Error('Indicá el motivo de la anulación.')

    const motivo = valor.trim()
    if (motivo.length < 5) throw new Error('El motivo de anulación debe tener al menos 5 caracteres.')
    if (motivo.length > 500) throw new Error('El motivo de anulación no puede superar los 500 caracteres.')

    return motivo
}
