import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

interface AsistenciaSeguimiento {
    horasJornada?: number
    horarioEsperadoEntrada?: string | null
    entrada?: string | null
    salida?: string | null
    horasTrabajadas?: number
    ajusteManual?: boolean
}

function normalizarMarca(valor: string | null | undefined): string {
    return (valor || '').trim().toLocaleLowerCase()
}

/**
 * Un seguimiento abierto conserva correcciones manuales, pero no debe ocultar
 * fichadas cargadas o corregidas después de haber guardado la semana.
 */
export function seguimientoAbiertoDebeRefrescarAsistencia(
    guardado: AsistenciaSeguimiento,
    calculado: AsistenciaSeguimiento,
): boolean {
    if (guardado.ajusteManual) return false

    return normalizarMarca(guardado.entrada) !== normalizarMarca(calculado.entrada)
        || Number(guardado.horasJornada || 0) !== Number(calculado.horasJornada || 0)
        || normalizarMarca(guardado.horarioEsperadoEntrada) !== normalizarMarca(calculado.horarioEsperadoEntrada)
        || normalizarMarca(guardado.salida) !== normalizarMarca(calculado.salida)
        || Math.abs(Number(guardado.horasTrabajadas || 0) - Number(calculado.horasTrabajadas || 0)) > 0.001
}

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
