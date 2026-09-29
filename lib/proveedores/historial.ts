import { estadoPagoDesdeMontos } from '../compras/validacion'

type Sede = { id: string; nombre: string }
type MovimientoPago = {
    id: string; fecha: Date; monto: number; medioPago: string; cajaOrigen: string | null
    tipo: string; estado: string; movimientoReversaDeId: string | null
}
type Gasto = {
    id: string; descripcion: string; monto: number; cantidad: number | null
    tipoRegistro: string | null; categoria: { nombre: string }; movimientosCaja: MovimientoPago[]
}
type RenglonStock = {
    id: string; cantidad: number; costoTotal: number | null
    insumo: { nombre: string; unidadMedida: string }
}
export type CompraHistorial = {
    id: string; numeroFactura: string | null; fechaFactura: Date | null; fechaMovimiento: Date
    costoTotal: number; montoPagado: number; observaciones: string | null
    ubicacion: Sede | null; movimientosStock: RenglonStock[]; gastos: Gasto[]
}
export type MovimientoHistoricoProveedor = RenglonStock & {
    numeroFactura: string | null; fechaFactura: Date | null; fecha: Date
    montoPagado: number | null; estadoPago: string | null; observaciones: string | null
    ubicacion: Sede | null; gasto: { id: string; movimientosCaja: MovimientoPago[] } | null
}
type CajaHistorial = { tipo: string; nombre: string | null; ubicacion: { nombre: string } | null }
export type PagoProveedor = {
    id: string; fecha: string; monto: number; medioPago: string
    caja: string; sedeCaja: string | null
}
export type FacturaProveedor = {
    id: string; origen: 'compra' | 'historico'; numeroFactura: string | null
    fecha: string; fechaIngreso: string; sede: Sede | null; observaciones: string | null
    total: number; pagado: number; pendiente: number; estadoPago: string
    items: { id: string; tipo: 'insumo' | 'gasto'; descripcion: string; cantidad: number | null; unidad: string | null; total: number | null }[]
    pagos: PagoProveedor[]; pagoSinDetalle: boolean
}

const moneda = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100
const nombresCaja: Record<string, string> = {
    caja_madre: 'Caja Madre', caja_chica: 'Caja Chica', caja_chica_local: 'Caja Chica Local',
    local: 'Caja Local', mercado_pago: 'Mercado Pago', mercado_pago_juani: 'Mercado Pago Juani',
}
const diaArgentina = (fecha: Date) => fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

export function construirHistorialProveedor(
    compras: CompraHistorial[], historicos: MovimientoHistoricoProveedor[], cajas: CajaHistorial[],
): FacturaProveedor[] {
    const catalogo = new Map(cajas.map(caja => [caja.tipo, caja]))
    function pagosVigentes(movimientos: MovimientoPago[]): PagoProveedor[] {
        return [...new Map(movimientos
            .filter(mov => mov.tipo === 'egreso' && mov.estado === 'activo' && !mov.movimientoReversaDeId)
            .map(mov => [mov.id, mov])).values()]
            .sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id.localeCompare(b.id))
            .map(mov => ({
                id: mov.id, fecha: mov.fecha.toISOString(), monto: moneda(mov.monto), medioPago: mov.medioPago,
                caja: (mov.cajaOrigen && (catalogo.get(mov.cajaOrigen)?.nombre || nombresCaja[mov.cajaOrigen]))
                    || mov.cajaOrigen || 'Sin caja registrada',
                sedeCaja: mov.cajaOrigen ? catalogo.get(mov.cajaOrigen)?.ubicacion?.nombre || null : null,
            }))
    }
    const itemStock = (mov: RenglonStock): FacturaProveedor['items'][number] => ({
        id: mov.id, tipo: 'insumo', descripcion: mov.insumo.nombre,
        cantidad: mov.cantidad, unidad: mov.insumo.unidadMedida, total: mov.costoTotal,
    })
    const facturas: FacturaProveedor[] = compras.map(compra => ({
        id: compra.id, origen: 'compra', numeroFactura: compra.numeroFactura,
        fecha: (compra.fechaFactura || compra.fechaMovimiento).toISOString(), fechaIngreso: compra.fechaMovimiento.toISOString(),
        sede: compra.ubicacion, observaciones: compra.observaciones,
        total: moneda(compra.costoTotal), pagado: moneda(compra.montoPagado),
        pendiente: moneda(Math.max(0, compra.costoTotal - compra.montoPagado)),
        estadoPago: estadoPagoDesdeMontos(compra.costoTotal, compra.montoPagado),
        items: [
            ...compra.movimientosStock.map(itemStock),
            ...compra.gastos.filter(gasto => gasto.tipoRegistro === 'concepto_compra').map(gasto => ({
                id: gasto.id, tipo: 'gasto' as const, descripcion: gasto.descripcion,
                cantidad: gasto.cantidad, unidad: null, total: gasto.monto,
            })),
        ],
        pagos: pagosVigentes(compra.gastos.flatMap(gasto => gasto.movimientosCaja)), pagoSinDetalle: false,
    }))

    const grupos = new Map<string, MovimientoHistoricoProveedor[]>()
    for (const mov of historicos) {
        const numero = mov.numeroFactura?.trim().toLocaleLowerCase('es-AR')
        // Sin cabecera, la fecha y la sede evitan unir números reutilizados en operaciones distintas.
        const clave = numero
            ? JSON.stringify([numero, diaArgentina(mov.fechaFactura || mov.fecha), mov.ubicacion?.id || null])
            : mov.gasto ? JSON.stringify(['gasto', mov.gasto.id, diaArgentina(mov.fechaFactura || mov.fecha), mov.ubicacion?.id || null]) : `movimiento:${mov.id}`
        const grupo = grupos.get(clave)
        if (grupo) grupo.push(mov)
        else grupos.set(clave, [mov])
    }
    for (const grupo of grupos.values()) {
        grupo.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id.localeCompare(b.id))
        const primero = grupo[0]
        const total = moneda(grupo.reduce((suma, mov) => suma + (mov.costoTotal || 0), 0))
        // En el circuito anterior, «pagado» podía guardarse sin montoPagado; confirma el total, pero no el medio ni la fecha del pago.
        const pagado = moneda(grupo.reduce((suma, mov) => suma
            + (mov.estadoPago === 'pagado' ? mov.costoTotal || 0 : mov.montoPagado || 0), 0))
        facturas.push({
            id: primero.id, origen: 'historico', numeroFactura: primero.numeroFactura,
            fecha: (primero.fechaFactura || primero.fecha).toISOString(), fechaIngreso: primero.fecha.toISOString(),
            sede: primero.ubicacion, observaciones: [...new Set(grupo.map(mov => mov.observaciones).filter(Boolean))].join(' · ') || null,
            total, pagado, pendiente: moneda(Math.max(0, total - pagado)),
            estadoPago: grupo.every(mov => mov.estadoPago === 'pagado') ? 'pagado' : estadoPagoDesdeMontos(total, pagado),
            items: grupo.map(itemStock), pagos: pagosVigentes(grupo.flatMap(mov => mov.gasto?.movimientosCaja || [])),
            pagoSinDetalle: false,
        })
    }
    // Un pago compartido por varias facturas antiguas no acredita por sí solo cuánto se abonó en cada una.
    const usosPago = new Map<string, number>()
    for (const factura of facturas) for (const pago of factura.pagos) usosPago.set(pago.id, (usosPago.get(pago.id) || 0) + 1)
    for (const factura of facturas) {
        factura.pagos = factura.pagos.filter(pago => usosPago.get(pago.id) === 1)
        factura.pagoSinDetalle = Math.abs(factura.pagado - moneda(factura.pagos.reduce((suma, pago) => suma + pago.monto, 0))) > 0.01
            || (factura.estadoPago === 'pagado' && factura.pagado === 0 && factura.total > 0)
    }
    return facturas.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id))
}

export function resumirHistorialProveedor(facturas: FacturaProveedor[]) {
    return {
        cantidadFacturas: facturas.length,
        totalFacturado: moneda(facturas.reduce((suma, factura) => suma + factura.total, 0)),
        totalPagado: moneda(facturas.reduce((suma, factura) => suma + factura.pagado, 0)),
        totalPendiente: moneda(facturas.reduce((suma, factura) => suma + factura.pendiente, 0)),
        sinDetallePago: facturas.filter(factura => factura.pagoSinDetalle).length,
    }
}

export function filtrarHistorialProveedor(facturas: FacturaProveedor[], filtros: {
    busqueda?: string; sede?: string; estado?: string; desde?: string; hasta?: string
}) {
    const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').trim()
    const busqueda = normalizar(filtros.busqueda || '')
    return facturas.filter(factura => {
        const fecha = diaArgentina(new Date(factura.fecha))
        return (!filtros.sede || (factura.sede?.id || 'sin-sede') === filtros.sede)
            && (!filtros.estado || factura.estadoPago === filtros.estado)
            && (!filtros.desde || fecha >= filtros.desde) && (!filtros.hasta || fecha <= filtros.hasta)
            && (!busqueda || normalizar([
                factura.numeroFactura || '', factura.sede?.nombre || '', factura.observaciones || '',
                ...factura.items.map(item => item.descripcion), ...factura.pagos.flatMap(pago => [pago.caja, pago.medioPago]),
            ].join(' ')).includes(busqueda))
    })
}
