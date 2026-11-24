// La base histórica se guardaba por sándwich; se muestra por plancha al revisarla.
export function cantidadParaPlancha(alcance: string, cantidadGuardada: number) {
    return alcance === 'base' ? cantidadGuardada * 8 : cantidadGuardada
}
