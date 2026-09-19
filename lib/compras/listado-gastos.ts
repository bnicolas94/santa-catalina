type ConceptoGastoBuscable = {
    descripcion: string
    categoria: { nombre: string }
}

export type FacturaGastoBuscable = {
    numeroFactura: string | null
    proveedor: { nombre: string } | null
    ubicacion: { nombre: string } | null
    gastos: ConceptoGastoBuscable[]
}

function normalizarBusqueda(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-AR')
        .trim()
}

export function filtrarFacturasGasto<T extends FacturaGastoBuscable>(facturas: T[], busqueda: string): T[] {
    const termino = normalizarBusqueda(busqueda)
    if (!termino) return facturas

    return facturas.filter(factura => normalizarBusqueda([
        factura.numeroFactura || '',
        factura.proveedor?.nombre || '',
        factura.ubicacion?.nombre || '',
        ...factura.gastos.flatMap(gasto => [gasto.descripcion, gasto.categoria.nombre]),
    ].join(' ')).includes(termino))
}

export function paginaFacturasGasto<T>(facturas: T[], pagina: number, porPagina: number): T[] {
    const paginaValida = Number.isInteger(pagina) && pagina > 0 ? pagina : 1
    const cantidadValida = Number.isInteger(porPagina) && porPagina > 0 ? porPagina : 10
    const inicio = (paginaValida - 1) * cantidadValida
    return facturas.slice(inicio, inicio + cantidadValida)
}
