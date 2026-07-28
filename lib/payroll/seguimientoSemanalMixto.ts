import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export function fechasSeguimientoSemanal(desdeInformado: string, hastaInformado: string): string[] {
    const desde = validarFechaCivilRRHH(desdeInformado)
    const hasta = validarFechaCivilRRHH(hastaInformado)
    if (sumarDiasRRHH(desde, 6) !== hasta) {
        throw new Error('El seguimiento debe abarcar una semana completa de siete días.')
    }
    return Array.from({ length: 7 }, (_, indice) => sumarDiasRRHH(desde, indice))
}

export function validarFechasDesgloseSemanal(
    desde: string,
    hasta: string,
    dias: Array<{ fecha?: unknown }>,
) {
    const esperadas = fechasSeguimientoSemanal(desde, hasta)
    const recibidas = dias.map(dia => typeof dia.fecha === 'string' ? dia.fecha : '')
    if (new Set(recibidas).size !== esperadas.length
        || esperadas.some((fecha, indice) => recibidas[indice] !== fecha)) {
        throw new Error('El detalle diario no coincide con la semana seleccionada.')
    }
    return esperadas
}
