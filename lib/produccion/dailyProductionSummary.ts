export interface DailyProductionSummaryItem {
    key: string
    code: string
    name: string
    presentationSize: number | null
    packages: number
}

interface PresentationLike {
    id: string
    cantidad: number
}

interface DailyLotLike {
    estado: string
    unidadesProducidas: number
    unidadesRechazadas?: number | null
    distribucion?: unknown
    movimientosProducto?: Array<{ presentacionId?: string | null; cantidad: number }>
    producto?: {
        id?: string
        codigoInterno?: string
        nombre?: string
        presentaciones?: PresentationLike[]
    }
}

function positiveQuantity(value: unknown) {
    const quantity = Number(value)
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

export function buildDailyProductionSummary(lots: DailyLotLike[]): DailyProductionSummaryItem[] {
    const grouped = new Map<string, DailyProductionSummaryItem>()

    for (const lot of lots) {
        if (lot.estado === 'en_produccion' || lot.estado === 'cancelado' || !lot.producto) continue

        const presentations = lot.producto.presentaciones || []
        const stockMovements = (lot.movimientosProducto || [])
            .map(item => ({ presentacionId: item.presentacionId, cantidad: positiveQuantity(item.cantidad) }))
            .filter(item => item.presentacionId && item.cantidad > 0)
        const savedDistribution = Array.isArray(lot.distribucion)
            ? lot.distribucion
                .map(item => item as { presentacionId?: string; cantidad?: unknown })
                .map(item => ({ presentacionId: item.presentacionId, cantidad: positiveQuantity(item.cantidad) }))
                .filter(item => item.presentacionId && item.cantidad > 0)
            : []
        const fallbackPresentation = [...presentations].sort((a, b) => b.cantidad - a.cantidad)[0]
        const fallbackQuantity = Math.max(Number(lot.unidadesProducidas || 0) - Number(lot.unidadesRechazadas || 0), 0)
        const packageEntries = stockMovements.length > 0
            ? stockMovements
            : savedDistribution.length > 0
                ? savedDistribution
                : fallbackPresentation && fallbackQuantity > 0
                    ? [{ presentacionId: fallbackPresentation.id, cantidad: fallbackQuantity }]
                    : []

        for (const entry of packageEntries) {
            const presentation = presentations.find(item => item.id === entry.presentacionId)
            const productKey = lot.producto.id || lot.producto.codigoInterno || lot.producto.nombre || 'producto'
            const key = `${productKey}-${entry.presentacionId}`
            const current = grouped.get(key)
            if (current) current.packages += entry.cantidad
            else grouped.set(key, {
                key,
                code: lot.producto.codigoInterno || '',
                name: lot.producto.nombre || 'Producto',
                presentationSize: presentation?.cantidad || null,
                packages: entry.cantidad,
            })
        }
    }

    return [...grouped.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'es') || (b.presentationSize || 0) - (a.presentationSize || 0)
    )
}
