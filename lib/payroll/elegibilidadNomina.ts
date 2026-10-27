export interface ConfiguracionElegibilidadNomina {
    activo?: boolean
    incluidoNomina?: boolean
}

export function empleadoIncluidoEnNomina(empleado: ConfiguracionElegibilidadNomina): boolean {
    return empleado.activo !== false && empleado.incluidoNomina !== false
}

export function validarEmpleadoIncluidoEnNomina(empleado: ConfiguracionElegibilidadNomina): void {
    if (!empleadoIncluidoEnNomina(empleado)) {
        throw new Error('Esta persona no está incluida en la nómina y no puede recibir liquidaciones de sueldo.')
    }
}
