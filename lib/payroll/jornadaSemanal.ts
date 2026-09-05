const HORAS_JORNADA_DOMINGO = 4

function diaSemana(fecha: string): number {
    const [anio, mes, dia] = fecha.split('-').map(Number)
    return new Date(anio, mes - 1, dia).getDay()
}

/**
 * Devuelve la jornada esperada para liquidar una fecha concreta.
 * El domingo es una jornada general de cuatro horas y el sábado puede
 * personalizarse en la ficha sin alterar la configuración de otros empleados.
 */
export function horasJornadaParaFecha(
    fecha: string,
    horasDiarias: number | null | undefined,
    horasSabado?: number | null,
): number {
    const jornadaHabitual = horasDiarias && horasDiarias > 0 ? horasDiarias : 8
    const dia = diaSemana(fecha)

    if (dia === 0) return HORAS_JORNADA_DOMINGO
    if (dia === 6 && horasSabado && horasSabado > 0) return horasSabado
    return jornadaHabitual
}
