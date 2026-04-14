/**
 * Utilidades de formateo para el módulo de reportes.
 */

/**
 * Formatea un número como moneda argentina.
 */
export function formatCurrency(value: number | null | undefined): string {
    if (value == null) return '$0'
    return '$' + Math.round(value).toLocaleString('es-AR')
}

/**
 * Formatea un número como moneda con decimales.
 */
export function formatCurrencyDecimals(value: number | null | undefined, decimals: number = 2): string {
    if (value == null) return '$0'
    return '$' + value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/**
 * Formatea un número como porcentaje.
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
    if (value == null) return '0%'
    return value.toFixed(decimals).replace('.', ',') + '%'
}

/**
 * Formatea un número con separador de miles.
 */
export function formatNumber(value: number | null | undefined): string {
    if (value == null) return '0'
    return Math.round(value).toLocaleString('es-AR')
}

/**
 * Formatea un número con decimales.
 */
export function formatDecimal(value: number | null | undefined, decimals: number = 2): string {
    if (value == null) return '0'
    return value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/**
 * Calcula y formatea el delta (cambio) entre dos valores.
 * Retorna { text, color, arrow, rawPercent }
 */
export function formatDelta(
    current: number,
    previous: number,
    options: { invertColor?: boolean } = {}
): { text: string; color: string; arrow: string; rawPercent: number } {
    if (previous === 0) {
        return current > 0
            ? { text: '+∞', color: 'var(--color-success)', arrow: '▲', rawPercent: 100 }
            : { text: '—', color: 'var(--color-gray-400)', arrow: '', rawPercent: 0 }
    }

    const percent = ((current - previous) / Math.abs(previous)) * 100
    const isPositive = percent > 0
    const isNeutral = Math.abs(percent) < 0.5

    if (isNeutral) {
        return { text: '≈ 0%', color: 'var(--color-gray-400)', arrow: '—', rawPercent: 0 }
    }

    // invertColor: para costos/gastos, subir es malo
    const colorPositive = options.invertColor ? 'var(--color-danger)' : 'var(--color-success)'
    const colorNegative = options.invertColor ? 'var(--color-success)' : 'var(--color-danger)'

    return {
        text: `${isPositive ? '+' : ''}${percent.toFixed(1).replace('.', ',')}%`,
        color: isPositive ? colorPositive : colorNegative,
        arrow: isPositive ? '▲' : '▼',
        rawPercent: percent
    }
}

/**
 * Formatea una fecha como string legible.
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Formatea una fecha corta (sin año).
 */
export function formatDateShort(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * Paleta de colores consistente para gráficos.
 */
export const CHART_COLORS = {
    primary: '#D11F35',
    secondary: '#540302',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    palette: [
        '#3498DB', '#E74C3C', '#2ECC71', '#F39C12',
        '#9B59B6', '#1ABC9C', '#E67E22', '#34495E',
        '#16A085', '#C0392B', '#2980B9', '#8E44AD'
    ]
}

/**
 * Genera un color de la paleta por índice.
 */
export function getChartColor(index: number): string {
    return CHART_COLORS.palette[index % CHART_COLORS.palette.length]
}
