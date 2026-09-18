export interface UsuarioCajas { id?: string; rol?: string; ubicacionId?: string | null; ubicacionTipo?: string | null; permisos?: { permisoCaja?: boolean } }
export interface CajaAcceso { tipo: string; activo: boolean; ubicacionId: string | null; recibeDepositos?: boolean; ubicacion?: { activo: boolean } | null }
export class CajaValidationError extends Error {}

export function tieneAccesoCaja(usuario: UsuarioCajas, caja: CajaAcceso, escritura = true) {
    if (escritura && (!caja.activo || (caja.ubicacion && !caja.ubicacion.activo))) return false
    if (usuario.rol === 'ADMIN') return true
    if (escritura && caja.recibeDepositos) return false
    return Boolean(usuario.ubicacionId && caja.ubicacionId === usuario.ubicacionId && caja.ubicacion?.activo &&
        (usuario.permisos?.permisoCaja || usuario.ubicacionTipo === 'LOCAL'))
}

export function validarDatosCaja(input: unknown) {
    if (!input || typeof input !== 'object') throw new CajaValidationError('Datos de caja inválidos.')
    const data = input as Record<string, unknown>
    if (typeof data.nombre !== 'string' || !data.nombre.trim() || data.nombre.trim().length > 100) throw new CajaValidationError('Ingresá un nombre de hasta 100 caracteres.')
    if (data.ubicacionId !== null && (typeof data.ubicacionId !== 'string' || !data.ubicacionId.trim())) throw new CajaValidationError('Seleccioná una sede.')
    if (typeof data.activo !== 'boolean' || typeof data.recibeDepositos !== 'boolean') throw new CajaValidationError('Estado de caja inválido.')
    const concepto = typeof data.conceptoDeposito === 'string' ? data.conceptoDeposito.trim() : 'Depósito diario'
    if (!concepto || concepto.length > 100) throw new CajaValidationError('Ingresá un concepto de depósito de hasta 100 caracteres.')
    if (data.recibeDepositos && !data.ubicacionId) throw new CajaValidationError('La caja de depósitos debe estar vinculada a una sede.')
    return { nombre: data.nombre.trim(), ubicacionId: data.ubicacionId as string | null, activo: data.activo, recibeDepositos: data.recibeDepositos, conceptoDeposito: concepto }
}

export function validarCambioCaja(actual: { ubicacionId: string | null; sistema: boolean; saldo: number }, nuevo: ReturnType<typeof validarDatosCaja>, tieneHistorial: boolean, pendientes: boolean) {
    if (!nuevo.activo && actual.sistema) throw new CajaValidationError('Esta caja es utilizada por otros módulos y no puede desactivarse.')
    if (!nuevo.activo && (Math.abs(actual.saldo) > 0.000001 || pendientes)) throw new CajaValidationError('Para desactivar la caja, primero dejá su saldo en cero y resolvé los depósitos pendientes.')
    if (actual.ubicacionId && actual.ubicacionId !== nuevo.ubicacionId && (tieneHistorial || Math.abs(actual.saldo) > 0.000001 || pendientes)) throw new CajaValidationError('La caja tiene historial en su sede. Creá otra caja para la nueva sede.')
}
