import { parseCantidadConteo } from '@/lib/insumos/conteos'

export function fechaLocalArgentina(fecha = new Date()): string {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(fecha)
    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || ''
    return `${valor('year')}-${valor('month')}-${valor('day')}`
}

export function leerCantidadOpcional(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null
    const cantidad = parseCantidadConteo(value)
    if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad > 1_000_000_000) {
        throw new Error('Las cantidades deben ser números entre 0 y 1.000.000.000')
    }
    return cantidad
}

export type DetalleReporteInput = { insumoId: string; cantidadInformada: number | null; cantidadSolicitada: number | null }

export function leerReporteInput(body: unknown): { version: number; observaciones: string | null; detalles: DetalleReporteInput[] } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Reporte inválido')
    const input = body as Record<string, unknown>
    if (!Number.isInteger(input.version) || (input.version as number) < 0) throw new Error('Versión de reporte inválida')
    if (!Array.isArray(input.detalles) || input.detalles.length > 1000) throw new Error('Detalle de reporte inválido')
    const detalles = input.detalles.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Insumo inválido')
        const fila = item as Record<string, unknown>
        if (typeof fila.insumoId !== 'string' || !fila.insumoId) throw new Error('Insumo inválido')
        return { insumoId: fila.insumoId, cantidadInformada: leerCantidadOpcional(fila.cantidadInformada), cantidadSolicitada: leerCantidadOpcional(fila.cantidadSolicitada) }
    }).filter((item) => item.cantidadInformada !== null || item.cantidadSolicitada !== null)
    if (new Set(detalles.map((item) => item.insumoId)).size !== detalles.length) throw new Error('Hay insumos repetidos')
    const observaciones = typeof input.observaciones === 'string' ? input.observaciones.trim() : ''
    if (observaciones.length > 500) throw new Error('Las observaciones superan 500 caracteres')
    return { version: input.version as number, observaciones: observaciones || null, detalles }
}
