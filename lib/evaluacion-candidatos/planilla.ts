import type { Vista } from './tipos'
export const VISTA_INICIAL: Vista = { buscar: '', columna: 0, filtro: '', orden: 0, descendente: false }
export function filasVisibles(filas: string[][], vista: Vista) {
    const normal = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return filas.map((fila, indice) => ({ fila, indice })).filter(({ fila }) => (!vista.buscar || fila.some(c => normal(c).includes(normal(vista.buscar)))) && (!vista.filtro || normal(fila[vista.columna] ?? '').includes(normal(vista.filtro)))).sort((a, b) => (a.fila[vista.orden] ?? '').localeCompare(b.fila[vista.orden] ?? '', 'es', { numeric: true }) * (vista.descendente ? -1 : 1))
}
export function valorCelda(valor: string, filas: string[][]): number | null {
    if (!valor.startsWith('=')) return valor.trim() && Number.isFinite(Number(valor)) ? Number(valor) : null
    const producto = /^=\s*(-?\d+(?:\.\d+)?)\s*([*+\-/])\s*(-?\d+(?:\.\d+)?)\s*$/.exec(valor)
    if (producto) { const a = Number(producto[1]), b = Number(producto[3]); const n = producto[2] === '*' ? a * b : producto[2] === '+' ? a + b : producto[2] === '-' ? a - b : a / b; return Number.isFinite(n) ? n : null }
    const suma = /^=SUMA\(([A-Z])(\d+):([A-Z])(\d+)\)$/i.exec(valor)
    if (suma) { let total = 0; const desde = Number(suma[2]) - 1, hasta = Number(suma[4]) - 1; if (hasta - desde > 100 || desde < 0 || hasta >= filas.length) return null; for (let r = desde; r <= hasta; r++) for (let c = suma[1].toUpperCase().charCodeAt(0) - 65; c <= suma[3].toUpperCase().charCodeAt(0) - 65; c++) { const v = filas[r]?.[c]; if (v === undefined || v.startsWith('=')) return null; const n = Number(v); if (!Number.isFinite(n)) return null; total += n } return total }
    return null
}
