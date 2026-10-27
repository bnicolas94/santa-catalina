export type PersonaConNombre = {
    nombre: string
    apellido?: string | null
}
const comparadorNombres = new Intl.Collator('es-AR', {
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true,
})

export function nombreEmpleadoApellidoPrimero(persona: PersonaConNombre): string {
    const nombres = persona.nombre.trim()
    const apellido = persona.apellido?.trim() || ''
    return apellido ? `${apellido}, ${nombres}` : nombres
}

export function ordenarEmpleadosPorApellido<T extends PersonaConNombre>(empleados: readonly T[]): T[]
export function ordenarEmpleadosPorApellido<T>(empleados: readonly T[], obtenerPersona: (empleado: T) => PersonaConNombre): T[]
export function ordenarEmpleadosPorApellido<T>(
    empleados: readonly T[],
    obtenerPersona: (empleado: T) => PersonaConNombre = empleado => empleado as PersonaConNombre,
): T[] {
    return [...empleados].sort((a, b) => {
        const personaA = obtenerPersona(a)
        const personaB = obtenerPersona(b)
        const apellidoA = personaA.apellido?.trim() || ''
        const apellidoB = personaB.apellido?.trim() || ''
        if (!apellidoA && apellidoB) return 1
        if (apellidoA && !apellidoB) return -1

        const porApellido = comparadorNombres.compare(apellidoA, apellidoB)
        if (porApellido !== 0) return porApellido
        return comparadorNombres.compare(personaA.nombre.trim(), personaB.nombre.trim())
    })
}

