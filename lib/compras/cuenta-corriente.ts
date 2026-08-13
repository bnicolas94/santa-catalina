export type FacturaCuentaCorriente = {
    id: string
    proveedorId: string | null
    proveedorNombre: string
    numeroFactura: string | null
    fecha: Date
    costoTotal: number
    montoPagado: number
    origen: 'compra' | 'historico'
}

export type MovimientoHistoricoCuenta = Omit<FacturaCuentaCorriente, 'origen'>

const redondearMoneda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100

export function agruparMovimientosHistoricos(movimientos: MovimientoHistoricoCuenta[]): FacturaCuentaCorriente[] {
    const grupos = new Map<string, FacturaCuentaCorriente>()
    for (const movimiento of movimientos) {
        const numero = movimiento.numeroFactura?.trim() || null
        const clave = numero
            ? `${movimiento.proveedorId || 'sin-proveedor'}:${numero.toLocaleLowerCase('es-AR')}`
            : `movimiento:${movimiento.id}`
        const existente = grupos.get(clave)
        if (existente) {
            existente.costoTotal = redondearMoneda(existente.costoTotal + movimiento.costoTotal)
            existente.montoPagado = redondearMoneda(existente.montoPagado + movimiento.montoPagado)
            if (movimiento.fecha < existente.fecha) existente.fecha = movimiento.fecha
        } else {
            grupos.set(clave, { ...movimiento, numeroFactura: numero, origen: 'historico' })
        }
    }
    return [...grupos.values()]
}

export function resumirCuentaCorriente(facturas: FacturaCuentaCorriente[]) {
    const pendientes = facturas
        .map(factura => ({
            ...factura,
            costoTotal: redondearMoneda(factura.costoTotal),
            montoPagado: redondearMoneda(factura.montoPagado),
            saldoPendiente: redondearMoneda(Math.max(0, factura.costoTotal - factura.montoPagado)),
        }))
        .filter(factura => factura.saldoPendiente > 0.01)

    const grupos = new Map<string, {
        proveedorId: string | null
        proveedorNombre: string
        facturas: typeof pendientes
    }>()
    for (const factura of pendientes) {
        const clave = factura.proveedorId || `nombre:${factura.proveedorNombre.toLocaleLowerCase('es-AR')}`
        const grupo = grupos.get(clave)
        if (grupo) grupo.facturas.push(factura)
        else grupos.set(clave, {
            proveedorId: factura.proveedorId,
            proveedorNombre: factura.proveedorNombre,
            facturas: [factura],
        })
    }

    const proveedores = [...grupos.values()].map(grupo => {
        const facturasOrdenadas = grupo.facturas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
        return {
            proveedorId: grupo.proveedorId,
            proveedorNombre: grupo.proveedorNombre,
            cantidadFacturas: facturasOrdenadas.length,
            totalFacturado: redondearMoneda(facturasOrdenadas.reduce((total, factura) => total + factura.costoTotal, 0)),
            totalPagado: redondearMoneda(facturasOrdenadas.reduce((total, factura) => total + factura.montoPagado, 0)),
            saldoPendiente: redondearMoneda(facturasOrdenadas.reduce((total, factura) => total + factura.saldoPendiente, 0)),
            fechaMasAntigua: facturasOrdenadas[0]?.fecha || null,
            facturas: facturasOrdenadas,
        }
    }).sort((a, b) => b.saldoPendiente - a.saldoPendiente)

    return {
        cantidadProveedores: proveedores.length,
        cantidadFacturas: proveedores.reduce((total, proveedor) => total + proveedor.cantidadFacturas, 0),
        totalFacturado: redondearMoneda(proveedores.reduce((total, proveedor) => total + proveedor.totalFacturado, 0)),
        totalPagado: redondearMoneda(proveedores.reduce((total, proveedor) => total + proveedor.totalPagado, 0)),
        totalPendiente: redondearMoneda(proveedores.reduce((total, proveedor) => total + proveedor.saldoPendiente, 0)),
        proveedores,
    }
}
