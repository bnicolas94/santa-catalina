// La base histórica se guarda por sándwich; el editor trabaja por plancha de ocho.
export function cantidadParaPlancha(alcance: string, cantidadGuardada: number) {
    return alcance === 'base' ? cantidadGuardada * 8 : cantidadGuardada
}

export function cantidadParaGuardar(alcance: string, cantidadCargada: number) {
    return alcance === 'base' ? cantidadCargada / 8 : cantidadCargada
}
