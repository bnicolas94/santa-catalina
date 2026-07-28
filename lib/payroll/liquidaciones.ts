import { validarFechaCivilRRHH } from '@/lib/rrhh/fechas'

export type RangoLiquidacion = {
    desde: string
    hasta: string
}

function fechaDesdePartes(dia: string, mes: string, anio: string): string | null {
    const fecha = `${anio.padStart(4, '0')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    try {
        return validarFechaCivilRRHH(fecha)
    } catch {
        return null
    }
}

export function normalizarRangoLiquidacion(desde: string, hasta: string): RangoLiquidacion {
    const rango = {
        desde: validarFechaCivilRRHH(desde),
        hasta: validarFechaCivilRRHH(hasta),
    }
    if (rango.desde > rango.hasta) throw new Error('El inicio del período debe ser anterior o igual al fin.')
    return rango
}

export function rangosLiquidacionSeSuperponen(a: RangoLiquidacion, b: RangoLiquidacion): boolean {
    return a.desde <= b.hasta && a.hasta >= b.desde
}

export function rangoHistoricoLiquidacion(periodo: string | null | undefined, desglose?: unknown): RangoLiquidacion | null {
    if (Array.isArray(desglose)) {
        const fechas = desglose
            .map(item => item && typeof item === 'object' && 'fecha' in item ? String(item.fecha).slice(0, 10) : '')
            .filter(fecha => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
            .sort()
        if (fechas.length > 0) {
            try {
                return normalizarRangoLiquidacion(fechas[0], fechas[fechas.length - 1])
            } catch {
                // Continúa con la descripción histórica.
            }
        }
    }

    if (desglose && typeof desglose === 'object' && 'fechaInicioGoce' in desglose && 'fechaFinGoce' in desglose) {
        try {
            return normalizarRangoLiquidacion(
                String(desglose.fechaInicioGoce),
                String(desglose.fechaFinGoce),
            )
        } catch {
            // Continúa con la descripción histórica.
        }
    }

    const descripcion = (periodo || '').trim()
    const coincidencias = [...descripcion.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)]
    if (coincidencias.length >= 2) {
        const desde = fechaDesdePartes(coincidencias[0][1], coincidencias[0][2], coincidencias[0][3])
        const hasta = fechaDesdePartes(coincidencias[1][1], coincidencias[1][2], coincidencias[1][3])
        if (desde && hasta) {
            try {
                return normalizarRangoLiquidacion(desde, hasta)
            } catch {
                return null
            }
        }
    }

    const mes = descripcion.match(/(?:Masivo|MENSUAL|QUINCENAL|SEMANAL)\s*-\s*(\d{4})-(\d{2})/i)
    if (mes) {
        const anio = Number(mes[1])
        const numeroMes = Number(mes[2])
        if (numeroMes >= 1 && numeroMes <= 12) {
            const ultimoDia = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate()
            return {
                desde: `${mes[1]}-${mes[2]}-01`,
                hasta: `${mes[1]}-${mes[2]}-${String(ultimoDia).padStart(2, '0')}`,
            }
        }
    }

    const sac = descripcion.match(/SAC\s+([12])(?:º|°)?\s+Semestre\s+(\d{4})/i)
    if (sac) {
        return sac[1] === '1'
            ? { desde: `${sac[2]}-01-01`, hasta: `${sac[2]}-06-30` }
            : { desde: `${sac[2]}-07-01`, hasta: `${sac[2]}-12-31` }
    }

    return null
}

export function validarMotivoAnulacionLiquidacion(valor: unknown): string {
    const motivo = typeof valor === 'string' ? valor.trim() : ''
    if (motivo.length < 10 || motivo.length > 500) {
        throw new Error('El motivo de anulación debe tener entre 10 y 500 caracteres.')
    }
    return motivo
}

export function validarLiquidacionAnulable(input: {
    estado: string
    totalNeto: number
    registradaEnCaja: boolean | null
    movimientos: Array<{
        tipo: string
        monto: number
        cajaOrigen: string | null
        movimientoReversion: { id: string } | null
    }>
}): void {
    if (input.estado === 'anulado') throw new Error('La liquidación ya fue anulada.')
    if (input.estado !== 'pagado') throw new Error('Sólo puede anularse una liquidación pagada.')

    if (input.registradaEnCaja === false) {
        if (input.movimientos.length > 0) throw new Error('La liquidación tiene movimientos de Caja inesperados.')
        return
    }

    if (input.registradaEnCaja === null && input.movimientos.length === 0 && input.totalNeto > 0) {
        throw new Error('Esta liquidación es anterior a la trazabilidad de Caja y no puede anularse automáticamente.')
    }

    const requiereMovimiento = input.registradaEnCaja === true || input.movimientos.length > 0
    if (!requiereMovimiento) return
    if (input.movimientos.length < 1) {
        throw new Error('La liquidación no tiene movimientos de Caja vinculados.')
    }

    if (input.movimientos.some(movimiento => movimiento.tipo !== 'egreso' || !movimiento.cajaOrigen)) {
        throw new Error('La liquidación contiene un movimiento de Caja inválido para revertir.')
    }
    const montoCaja = input.movimientos.reduce((total, movimiento) => total + movimiento.monto, 0)
    if (Math.abs(montoCaja - input.totalNeto) > 0.009) {
        throw new Error('El importe de Caja no coincide con el neto de la liquidación.')
    }
    if (input.movimientos.some(movimiento => movimiento.movimientoReversion)) {
        throw new Error('El movimiento de Caja de la liquidación ya fue revertido.')
    }
}
