export class SedeValidationError extends Error {}

export function validarSede(input: unknown) {
    if (!input || typeof input !== 'object') throw new SedeValidationError('Datos de sede inválidos')
    const data = input as Record<string, unknown>
    if (typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.trim().length > 100) {
        throw new SedeValidationError('El nombre debe tener entre 1 y 100 caracteres')
    }
    if (data.tipo !== 'FABRICA' && data.tipo !== 'LOCAL') throw new SedeValidationError('Seleccioná Fábrica o Local')
    if (data.activo !== undefined && typeof data.activo !== 'boolean') throw new SedeValidationError('Estado inválido')
    return { nombre: data.nombre.trim(), tipo: data.tipo, ...(data.activo !== undefined ? { activo: data.activo as boolean } : {}) }
}

export function validarCambioTipo(actual: string, nuevo: string, asociaciones: Record<string, number>) {
    if (actual !== nuevo && Object.values(asociaciones).some(cantidad => cantidad > 0)) {
        throw new SedeValidationError('No se puede cambiar el tipo de una sede con registros asociados. Creá una nueva sede.')
    }
}
