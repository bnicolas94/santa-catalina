import { sumarDiasRRHH, validarFechaCivilRRHH } from '@/lib/rrhh/fechas'
import { esDiaLaboralConfigurado } from '@/lib/payroll/vacaciones'

export const MODALIDAD_MENSUAL_MIXTA = 'MENSUAL_MIXTA'
export const MODALIDAD_SEMANAL_EFECTIVO = 'SEMANAL_EFECTIVO'

export type MedioPagoMixto = 'TRANSFERENCIA' | 'EFECTIVO'

export interface CierreMixtoParaRecibo {
    efectivoCalculado?: unknown
    pagos?: Array<{
        medio?: unknown
        monto?: unknown
        estado?: unknown
    }> | null
}

/**
 * El comprobante interno del cierre mixto respalda solamente el efectivo.
 * Si ya existen pagos, toma el importe efectivamente registrado y vigente;
 * para cierres históricos sin el detalle cargado conserva el valor calculado.
 */
export function montoEfectivoReciboMixto(cierre?: CierreMixtoParaRecibo | null): number {
    if (!cierre) return 0
    const pagosEfectivo = (cierre.pagos || []).filter(pago => (
        pago.medio === 'EFECTIVO' && pago.estado !== 'ANULADO'
    ))
    const monto = pagosEfectivo.length > 0
        ? pagosEfectivo.reduce((total, pago) => total + Number(pago.monto || 0), 0)
        : Number(cierre.efectivoCalculado || 0)
    return Number.isFinite(monto) ? Math.max(0, Math.round(monto * 100) / 100) : 0
}

export interface ReferenciaDevengadoMensual {
    id: string
    totalNeto: number
    rango: { desde: string; hasta: string }
    desglose?: unknown
}

export function rangoMesLiquidacion(periodo: string): { desde: string; hasta: string } {
    if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('El período mensual es inválido.')
    const [anio, mes] = periodo.split('-').map(Number)
    if (mes < 1 || mes > 12) throw new Error('El período mensual es inválido.')
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
    const desde = validarFechaCivilRRHH(`${periodo}-01`)
    const hasta = validarFechaCivilRRHH(`${periodo}-${String(ultimoDia).padStart(2, '0')}`)
    return { desde, hasta }
}

export function periodoMensualCerrable(periodo: string, fechaActual: string): boolean {
    const { hasta } = rangoMesLiquidacion(periodo)
    return hasta < validarFechaCivilRRHH(fechaActual)
}

export function calcularDistribucionMixta(
    totalInformado: unknown,
    netoReciboInformado: unknown,
    pagosSemanalesInformados: unknown = 0,
) {
    const totalDevengado = Math.round(Number(totalInformado) * 100) / 100
    const transferencia = Math.round(Number(netoReciboInformado) * 100) / 100
    const pagosSemanales = Math.round(Number(pagosSemanalesInformados) * 100) / 100
    if (!Number.isFinite(totalDevengado) || totalDevengado <= 0) {
        throw new Error('El total devengado debe ser mayor a cero.')
    }
    if (!Number.isFinite(transferencia) || transferencia < 0) {
        throw new Error('El neto del recibo no puede ser negativo.')
    }
    if (!Number.isFinite(pagosSemanales) || pagosSemanales < 0) {
        throw new Error('El total semanal conciliado no puede ser negativo.')
    }
    if (transferencia + pagosSemanales - totalDevengado > 0.009) {
        throw new Error('El recibo más los pagos semanales conciliados superan el sueldo real calculado. Revisá los importes antes de continuar.')
    }
    return {
        totalDevengado,
        transferencia,
        efectivo: Math.round((totalDevengado - transferencia - pagosSemanales) * 100) / 100,
    }
}

export function resolverConciliacionSemanal<T extends { id: string; montoPagado: number }>(
    referencias: T[],
    aplicacionesInformadas: unknown,
) {
    const aplicaciones = Array.isArray(aplicacionesInformadas)
        ? aplicacionesInformadas.filter((item): item is { id: string; monto: unknown } => (
            typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string'
        ))
        : []
    const porId = new Map(aplicaciones.map(aplicacion => [aplicacion.id, aplicacion]))
    if (porId.size !== aplicaciones.length) throw new Error('Hay liquidaciones semanales repetidas en la conciliación.')
    if (porId.size !== referencias.length || referencias.some(referencia => !porId.has(referencia.id))) {
        throw new Error('Revisá todas las liquidaciones semanales detectadas antes de cerrar el mes.')
    }
    const liquidaciones = referencias.map(referencia => {
        const montoConciliado = Math.round(Number(porId.get(referencia.id)?.monto) * 100) / 100
        const montoDevengadoPeriodo = 'montoDevengadoPeriodo' in referencia
            ? Number(referencia.montoDevengadoPeriodo)
            : referencia.montoPagado
        const maximoAplicable = Math.min(referencia.montoPagado, montoDevengadoPeriodo)
        if (!Number.isFinite(montoConciliado) || montoConciliado < 0 || montoConciliado - maximoAplicable > 0.009) {
            throw new Error('El importe conciliado debe estar entre cero y lo efectivamente pagado que corresponde al mes.')
        }
        return { ...referencia, montoConciliado }
    })
    return {
        total: Math.round(liquidaciones.reduce((total, referencia) => total + referencia.montoConciliado, 0) * 100) / 100,
        liquidaciones,
    }
}

function fechasEntre(desde: string, hasta: string): string[] {
    const fechas: string[] = []
    for (let fecha = validarFechaCivilRRHH(desde); fecha <= hasta; fecha = sumarDiasRRHH(fecha, 1)) {
        fechas.push(fecha)
    }
    return fechas
}

/**
 * Determina cuánto de una liquidación semanal pertenece al mes calendario.
 * Si existe detalle diario usa su peso real; los Express históricos sin días
 * se prorratean por jornadas laborales configuradas y quedan auditables.
 */
export function montoDevengadoReferenciaEnPeriodo(
    referencia: ReferenciaDevengadoMensual,
    periodo: { desde: string; hasta: string },
    diasTrabajoSemana: string | null | undefined,
): number {
    const desde = referencia.rango.desde < periodo.desde ? periodo.desde : referencia.rango.desde
    const hasta = referencia.rango.hasta > periodo.hasta ? periodo.hasta : referencia.rango.hasta
    if (desde > hasta) return 0

    const totalNeto = Math.round(Number(referencia.totalNeto) * 100) / 100
    if (!Number.isFinite(totalNeto) || totalNeto < 0) throw new Error('La liquidación semanal tiene un total inválido.')
    if (referencia.rango.desde >= periodo.desde && referencia.rango.hasta <= periodo.hasta) return totalNeto

    if (Array.isArray(referencia.desglose)) {
        const dias = referencia.desglose.flatMap(item => {
            if (!item || typeof item !== 'object' || !('fecha' in item) || !('totalDia' in item)) return []
            const fecha = String(item.fecha).slice(0, 10)
            const totalDia = Number(item.totalDia)
            return /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(totalDia) && totalDia >= 0
                ? [{ fecha, totalDia }]
                : []
        })
        const baseCompleta = dias.reduce((total, dia) => total + dia.totalDia, 0)
        if (baseCompleta > 0) {
            const basePeriodo = dias
                .filter(dia => dia.fecha >= periodo.desde && dia.fecha <= periodo.hasta)
                .reduce((total, dia) => total + dia.totalDia, 0)
            return Math.round((totalNeto * basePeriodo / baseCompleta) * 100) / 100
        }
    }

    const fechasReferencia = fechasEntre(referencia.rango.desde, referencia.rango.hasta)
    const laborales = fechasReferencia.filter(fecha => esDiaLaboralConfigurado(diasTrabajoSemana, fecha))
    const desgloseGeneral = referencia.desglose && typeof referencia.desglose === 'object' && !Array.isArray(referencia.desglose)
        ? referencia.desglose as Record<string, unknown>
        : null
    const diasTrabajados = Math.floor(Number(desgloseGeneral?.diasTrabajados))
    const candidatas = laborales.length > 0 ? laborales : fechasReferencia
    const base = Number.isFinite(diasTrabajados) && diasTrabajados > 0 && diasTrabajados < candidatas.length
        ? candidatas.slice(0, diasTrabajados)
        : candidatas
    const dentroPeriodo = base.filter(fecha => fecha >= periodo.desde && fecha <= periodo.hasta).length
    return base.length > 0 ? Math.round((totalNeto * dentroPeriodo / base.length) * 100) / 100 : 0
}

export function consolidarDevengadoMensual(input: {
    periodo: { desde: string; hasta: string }
    diasActuales: Array<{ fecha: string; totalDia: number }>
    descuentoPendiente: number
    referencias: Array<ReferenciaDevengadoMensual & { montoDevengadoPeriodo: number }>
}) {
    const fechasCubiertas = new Set<string>()
    input.referencias.forEach(referencia => {
        const desde = referencia.rango.desde < input.periodo.desde ? input.periodo.desde : referencia.rango.desde
        const hasta = referencia.rango.hasta > input.periodo.hasta ? input.periodo.hasta : referencia.rango.hasta
        if (desde <= hasta) fechasEntre(desde, hasta).forEach(fecha => fechasCubiertas.add(fecha))
    })
    const seguimientoNoCubierto = input.diasActuales
        .filter(dia => dia.fecha >= input.periodo.desde && dia.fecha <= input.periodo.hasta && !fechasCubiertas.has(dia.fecha))
        .reduce((total, dia) => total + Number(dia.totalDia || 0), 0)
    const historicoSemanal = input.referencias.reduce((total, referencia) => total + referencia.montoDevengadoPeriodo, 0)
    const descuentoPendiente = Number(input.descuentoPendiente || 0)
    const totalDevengado = historicoSemanal + seguimientoNoCubierto - descuentoPendiente
    return {
        totalDevengado: Math.round(totalDevengado * 100) / 100,
        historicoSemanal: Math.round(historicoSemanal * 100) / 100,
        seguimientoNoCubierto: Math.round(seguimientoNoCubierto * 100) / 100,
        descuentoPendiente: Math.round(descuentoPendiente * 100) / 100,
        diasCubiertosPorHistorial: fechasCubiertas.size,
    }
}

export function montoPorMedio(
    distribucion: ReturnType<typeof calcularDistribucionMixta>,
    medio: MedioPagoMixto,
): number {
    return medio === 'TRANSFERENCIA' ? distribucion.transferencia : distribucion.efectivo
}

export function estadoCierreDesdePagos(
    distribucion: ReturnType<typeof calcularDistribucionMixta>,
    pagos: Array<{ medio: string; monto: number; estado?: string }>,
): 'PENDIENTE' | 'PARCIAL' | 'PAGADO' {
    const pagosVigentes = pagos.filter(pago => pago.estado !== 'ANULADO')
    const requerido = (['TRANSFERENCIA', 'EFECTIVO'] as MedioPagoMixto[])
        .filter(medio => montoPorMedio(distribucion, medio) > 0)
    const cubiertos = requerido.filter(medio => {
        const pagado = pagosVigentes
            .filter(pago => pago.medio === medio)
            .reduce((total, pago) => total + pago.monto, 0)
        return Math.abs(pagado - montoPorMedio(distribucion, medio)) <= 0.009
    })
    if (cubiertos.length === requerido.length) return 'PAGADO'
    return pagosVigentes.length > 0 ? 'PARCIAL' : 'PENDIENTE'
}

export function periodoSiguiente(periodo: string): string {
    const { hasta } = rangoMesLiquidacion(periodo)
    return sumarDiasRRHH(hasta, 1).slice(0, 7)
}
