export const CICLOS_ROL = ['DIARIO', 'SEMANAL', 'MENSUAL'] as const

export type CicloRol = typeof CICLOS_ROL[number]

export interface RolEmpleadoInput {
    nombre?: unknown
    descripcion?: unknown
    color?: unknown
    permisoDashboard?: unknown
    permisoStock?: unknown
    permisoCaja?: unknown
    permisoPersonal?: unknown
    permisoProduccion?: unknown
    permisoCostos?: unknown
    jornal?: unknown
    valorHoraExtra?: unknown
    cicloPago?: unknown
}

export class RolEmpleadoValidationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'RolEmpleadoValidationError'
    }
}

function montoNoNegativo(value: unknown, field: string): number {
    const parsed = Number(value ?? 0)
    if (!Number.isFinite(parsed) || parsed < 0) throw new RolEmpleadoValidationError(`${field} debe ser un importe válido mayor o igual a cero.`)
    return Math.round(parsed * 100) / 100
}

export function normalizarRolEmpleado(input: RolEmpleadoInput) {
    const nombre = String(input.nombre || '').trim().toUpperCase().replace(/\s+/g, '_')
    if (nombre.length < 2) throw new RolEmpleadoValidationError('El nombre del tipo de empleado debe tener al menos 2 caracteres.')
    if (nombre.length > 40) throw new RolEmpleadoValidationError('El nombre del tipo de empleado no puede superar los 40 caracteres.')

    const cicloPago = String(input.cicloPago || 'SEMANAL').toUpperCase()
    if (!CICLOS_ROL.includes(cicloPago as CicloRol)) throw new RolEmpleadoValidationError('El período salarial seleccionado no es válido.')

    const color = String(input.color || '#9b1c31').trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(color)) throw new RolEmpleadoValidationError('El color del tipo de empleado no es válido.')

    const descripcion = String(input.descripcion || '').trim()
    return {
        nombre,
        descripcion: descripcion || null,
        color,
        permisoDashboard: input.permisoDashboard === true,
        permisoStock: input.permisoStock === true,
        permisoCaja: input.permisoCaja === true,
        permisoPersonal: input.permisoPersonal === true,
        permisoProduccion: input.permisoProduccion === true,
        permisoCostos: input.permisoCostos === true,
        jornal: montoNoNegativo(input.jornal, 'El monto base'),
        valorHoraExtra: montoNoNegativo(input.valorHoraExtra, 'El valor de hora extra'),
        cicloPago: cicloPago as CicloRol,
    }
}
