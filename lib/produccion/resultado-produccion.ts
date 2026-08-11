export type ResultadoProduccion = {
    totalProducido: number
    paquetesBuenos: number
    paquetesRechazados: number
}

export function calcularResultadoProduccion(
    totalProducido: number,
    paquetesRechazados: number,
): ResultadoProduccion {
    if (!Number.isInteger(totalProducido) || totalProducido < 0) {
        throw new Error('El total producido debe ser un entero mayor o igual a cero')
    }
    if (!Number.isInteger(paquetesRechazados) || paquetesRechazados < 0) {
        throw new Error('Los paquetes rechazados deben ser un entero mayor o igual a cero')
    }
    if (paquetesRechazados > totalProducido) {
        throw new Error('Los paquetes rechazados no pueden superar el total producido')
    }

    return {
        totalProducido,
        paquetesBuenos: totalProducido - paquetesRechazados,
        paquetesRechazados,
    }
}
