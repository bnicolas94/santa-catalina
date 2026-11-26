export type ConteoConciliacion = {
    id: string
    fecha: Date
    detalles: { insumoId: string; cantidadContada: number;
        insumo: { nombre: string; unidadMedida: string; precioUnitario: number } }[]
}

export type MovimientoConciliacion = {
    insumoId: string
    tipo: string
    cantidad: number
    loteOrigenId: string | null
    detalleConteo: { id: string } | null
}

const redondear = (valor: number) => Math.round(valor * 1_000_000) / 1_000_000
const tolerancia = 0.001

export function calcularConciliacionInsumos(
    inicial: ConteoConciliacion,
    final: ConteoConciliacion,
    movimientos: MovimientoConciliacion[],
) {
    const inicio = new Map(inicial.detalles.map(detalle => [detalle.insumoId, detalle]))
    const cierre = new Map(final.detalles.map(detalle => [detalle.insumoId, detalle]))
    const movimientosPorInsumo = new Map<string, MovimientoConciliacion[]>()
    for (const movimiento of movimientos) {
        if (movimiento.detalleConteo) continue
        const lista = movimientosPorInsumo.get(movimiento.insumoId) ?? []
        lista.push(movimiento)
        movimientosPorInsumo.set(movimiento.insumoId, lista)
    }

    const filas = [...inicio].filter(([id]) => cierre.has(id)).map(([id, apertura]) => {
        const fin = cierre.get(id)!
        let entradas = 0, salidasOtras = 0, usoRegistrado = 0, movimientosNoReconocidos = 0
        for (const movimiento of movimientosPorInsumo.get(id) ?? []) {
            if (!Number.isFinite(movimiento.cantidad) || movimiento.cantidad < 0) { movimientosNoReconocidos++; continue }
            if (movimiento.loteOrigenId) {
                if (movimiento.tipo === 'salida') usoRegistrado += movimiento.cantidad
                else if (movimiento.tipo === 'entrada') usoRegistrado -= movimiento.cantidad
                else movimientosNoReconocidos++
            } else if (movimiento.tipo === 'entrada') entradas += movimiento.cantidad
            else if (['salida', 'merma'].includes(movimiento.tipo)) salidasOtras += movimiento.cantidad
            else movimientosNoReconocidos++
        }
        const stockEsperado = redondear(apertura.cantidadContada + entradas - salidasOtras - usoRegistrado)
        const usoSegunConteo = redondear(apertura.cantidadContada + entradas - salidasOtras - fin.cantidadContada)
        const diferencia = redondear(usoSegunConteo - usoRegistrado)
        const costoDiferencia = apertura.insumo.precioUnitario > 0
            ? redondear(Math.max(0, diferencia) * apertura.insumo.precioUnitario) : null
        const estado = movimientosNoReconocidos || usoSegunConteo < -tolerancia || usoRegistrado < -tolerancia ? 'revisar'
            : diferencia > tolerancia ? 'faltante' : diferencia < -tolerancia ? 'sobrante' : 'coincide'
        return { insumoId: id, nombre: apertura.insumo.nombre, unidad: apertura.insumo.unidadMedida,
            precioActual: apertura.insumo.precioUnitario, inicio: apertura.cantidadContada,
            entradas: redondear(entradas), salidasOtras: redondear(salidasOtras),
            usoRegistrado: redondear(usoRegistrado), usoSegunConteo, stockEsperado,
            fin: fin.cantidadContada, diferencia, costoDiferencia, estado, movimientosNoReconocidos }
    }).sort((a, b) => {
        const orden: Record<string, number> = { revisar: 0, faltante: 1, sobrante: 2, coincide: 3 }
        return orden[a.estado] - orden[b.estado] || Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.nombre.localeCompare(b.nombre, 'es')
    })
    const sinPar = [...inicio.values()].filter(d => !cierre.has(d.insumoId)).map(d => d.insumo.nombre)
        .concat([...cierre.values()].filter(d => !inicio.has(d.insumoId)).map(d => d.insumo.nombre))
    return { filas, sinPar: [...new Set(sinPar)].sort((a, b) => a.localeCompare(b, 'es')),
        resumen: { comparables: filas.length, faltantes: filas.filter(f => f.estado === 'faltante').length,
            sobrantes: filas.filter(f => f.estado === 'sobrante').length,
            coinciden: filas.filter(f => f.estado === 'coincide').length,
            revisar: filas.filter(f => f.estado === 'revisar').length,
            faltantesSinPrecio: filas.filter(f => f.estado === 'faltante' && f.costoDiferencia === null).length,
            costoFaltanteIdentificado: redondear(filas.reduce((total, f) => total + (f.estado === 'faltante' ? f.costoDiferencia ?? 0 : 0), 0)) } }
}
