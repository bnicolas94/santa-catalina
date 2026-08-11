const ALIAS_UNIDADES: Record<string, string> = {
    unidad: 'u',
    unidades: 'u',
    kilogramo: 'kg',
    kilogramos: 'kg',
    gramo: 'g',
    gramos: 'g',
    litro: 'lt',
    litros: 'lt',
    l: 'lt',
}

export function normalizarUnidadParaFormulario(unidad: string) {
    const valor = unidad.trim().toLowerCase()
    return ALIAS_UNIDADES[valor] || valor
}
