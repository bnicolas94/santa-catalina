export function normalizarNombreInsumo(nombre: string): string {
    return nombre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('es-AR')
}
