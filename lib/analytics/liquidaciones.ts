export type TipoLiquidacionAnalytics = 'NORMAL' | 'SAC' | 'VACACIONES' | 'FINAL' | 'HORAS_EXTRAS_ADEUDADAS' | 'OTRA'

export interface LiquidacionClasificable {
    tipo?: string | null
    periodo?: string | null
    totalNeto: number
}

const ETIQUETAS: Record<TipoLiquidacionAnalytics, string> = {
    NORMAL: 'Sueldo habitual',
    SAC: 'SAC / Aguinaldo',
    VACACIONES: 'Vacaciones',
    FINAL: 'Liquidación final',
    HORAS_EXTRAS_ADEUDADAS: 'Horas extras adeudadas',
    OTRA: 'Otras liquidaciones',
}

export function normalizarTipoLiquidacion(tipo: string | null | undefined, periodo?: string | null): TipoLiquidacionAnalytics {
    const valor = (tipo || 'NORMAL').trim().toUpperCase()
    const descripcion = (periodo || '').trim().toUpperCase()
    if (valor === 'SAC' || valor === 'AGUINALDO' || descripcion.includes('SAC') || descripcion.includes('AGUINALDO')) return 'SAC'
    if (valor === 'VACACIONES' || descripcion.includes('VACACIONES')) return 'VACACIONES'
    if (valor === 'FINAL' || valor === 'LIQUIDACION_FINAL' || descripcion.includes('LIQUIDACIÓN FINAL') || descripcion.includes('LIQUIDACION FINAL')) return 'FINAL'
    if (valor === 'HORAS_EXTRAS_ADEUDADAS' || descripcion.includes('HORAS EXTRAS ADEUDADAS')) return 'HORAS_EXTRAS_ADEUDADAS'
    if (valor === 'NORMAL' || valor === 'SEMANAL' || valor === 'MENSUAL' || valor === 'QUINCENAL' || valor === 'MENSUAL_MIXTA') return 'NORMAL'
    return 'OTRA'
}

export function etiquetaTipoLiquidacion(tipo: string | null | undefined, periodo?: string | null): string {
    return ETIQUETAS[normalizarTipoLiquidacion(tipo, periodo)]
}

export function agruparLiquidacionesPorTipo(liquidaciones: LiquidacionClasificable[]) {
    const grupos = new Map<TipoLiquidacionAnalytics, { tipo: TipoLiquidacionAnalytics; etiqueta: string; total: number; cantidad: number }>()

    for (const liquidacion of liquidaciones) {
        const tipo = normalizarTipoLiquidacion(liquidacion.tipo, liquidacion.periodo)
        const grupo = grupos.get(tipo) || { tipo, etiqueta: ETIQUETAS[tipo], total: 0, cantidad: 0 }
        grupo.total += liquidacion.totalNeto
        grupo.cantidad++
        grupos.set(tipo, grupo)
    }

    return [...grupos.values()].sort((a, b) => b.total - a.total)
}
