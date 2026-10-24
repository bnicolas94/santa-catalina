const comparadorNombres = new Intl.Collator('es-AR', {
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true,
})

export function ordenarReportePagosAlfabeticamente<T extends { empleado: string }>(filas: readonly T[]): T[] {
    return [...filas].sort((a, b) => comparadorNombres.compare(a.empleado.trim(), b.empleado.trim()))
}

