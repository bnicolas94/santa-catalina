export type OrdenCompraInput = {
    proveedorId: string
    ubicacionId: string | null
    observaciones: string | null
    detalles: Array<{ insumoId: string; cantidad: number; observaciones: string | null }>
}

function texto(value: unknown, maximo: number): string {
    return typeof value === 'string' ? value.trim().slice(0, maximo) : ''
}

export function leerOrdenCompraInput(value: unknown): OrdenCompraInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Datos de orden inválidos')
    const body = value as Record<string, unknown>
    const proveedorId = texto(body.proveedorId, 100)
    const ubicacionId = texto(body.ubicacionId, 100) || null
    const observaciones = texto(body.observaciones, 1000) || null
    if (!proveedorId) throw new Error('Seleccioná un proveedor')
    if (!Array.isArray(body.detalles) || body.detalles.length < 1 || body.detalles.length > 100) {
        throw new Error('La orden debe tener entre 1 y 100 insumos')
    }
    const detalles = body.detalles.map((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Renglón inválido')
        const item = raw as Record<string, unknown>
        const insumoId = texto(item.insumoId, 100)
        const cantidad = typeof item.cantidad === 'number' ? item.cantidad : Number(item.cantidad)
        if (!insumoId || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 1_000_000_000) {
            throw new Error('Cada insumo requiere una cantidad positiva válida')
        }
        return { insumoId, cantidad, observaciones: texto(item.observaciones, 300) || null }
    })
    if (new Set(detalles.map((item) => item.insumoId)).size !== detalles.length) {
        throw new Error('Un insumo no puede repetirse en la misma orden')
    }
    return { proveedorId, ubicacionId, observaciones, detalles }
}
