import assert from 'node:assert/strict'
import test from 'node:test'
import { construirHistorialProveedor, filtrarHistorialProveedor, resumirHistorialProveedor, type CompraHistorial, type MovimientoHistoricoProveedor } from './historial'

const sede = { id: 'fabrica', nombre: 'Fábrica' }
const pago = (id: string, monto: number, cambios = {}) => ({
    id, monto, fecha: new Date('2026-09-29T12:00:00Z'), medioPago: 'efectivo', cajaOrigen: 'caja_chica',
    tipo: 'egreso', estado: 'activo', movimientoReversaDeId: null, ...cambios,
})
const gasto = (id: string, movimientosCaja = [pago('pago-1', 40)]) => ({
    id, descripcion: 'Pago proveedor', monto: 40, cantidad: null, tipoRegistro: 'pago_proveedor',
    categoria: { nombre: 'Proveedores' }, movimientosCaja,
})
function compra(cambios: Partial<CompraHistorial> = {}): CompraHistorial {
    return {
        id: 'compra-1', numeroFactura: '7191', fechaFactura: new Date('2026-09-28T12:00:00Z'),
        fechaMovimiento: new Date('2026-09-29T12:00:00Z'), costoTotal: 100, montoPagado: 40,
        observaciones: null, ubicacion: sede,
        movimientosStock: [{ id: 'stock-1', cantidad: 10, costoTotal: 60, insumo: { nombre: 'Pan', unidadMedida: 'un' } }],
        gastos: [gasto('gasto-pago'), {
            id: 'servicio', descripcion: 'Flete', monto: 40, cantidad: 2, tipoRegistro: 'concepto_compra',
            categoria: { nombre: 'Logística' }, movimientosCaja: [],
        }], ...cambios,
    }
}
function historico(cambios: Partial<MovimientoHistoricoProveedor> = {}): MovimientoHistoricoProveedor {
    return {
        id: 'historico-1', numeroFactura: '10', fechaFactura: null, fecha: new Date('2026-09-20T12:00:00Z'),
        cantidad: 10, costoTotal: 100, montoPagado: 0, estadoPago: 'pendiente', observaciones: null,
        ubicacion: sede, insumo: { nombre: 'Pan', unidadMedida: 'un' }, gasto: null, ...cambios,
    }
}

test('una factura mixta usa la cabecera para importes y conserva insumos, servicios y sede', () => {
    const [factura] = construirHistorialProveedor([compra()], [], [])
    assert.equal(factura.total, 100)
    assert.equal(factura.pagado, 40)
    assert.equal(factura.pendiente, 60)
    assert.equal(factura.estadoPago, 'a_cuenta')
    assert.deepEqual(factura.items.map(item => [item.descripcion, item.total]), [['Pan', 60], ['Flete', 40]])
    assert.deepEqual(factura.sede, sede)
    assert.equal(factura.fecha.slice(0, 10), '2026-09-28')
    assert.equal(factura.fechaIngreso.slice(0, 10), '2026-09-29')
    assert.equal(factura.pagoSinDetalle, false)
})

test('muestra pagos divididos y posteriores con medio y caja reales, incluyendo cajas inactivas del catálogo', () => {
    const transferencia = pago('transferencia', 30, { medioPago: 'transferencia', cajaOrigen: 'mercado_pago' })
    const posterior = pago('posterior', 30, { cajaOrigen: 'caja_personalizada', fecha: new Date('2026-09-30T12:00:00Z') })
    const [factura] = construirHistorialProveedor([compra({
        montoPagado: 100,
        gastos: [gasto('dividido', [pago('efectivo', 40), transferencia]), gasto('posterior', [posterior])],
    })], [], [{ tipo: 'caja_personalizada', nombre: 'Caja Fuerte', ubicacion: { nombre: 'Villa Elisa' } }])
    assert.equal(factura.estadoPago, 'pagado')
    assert.equal(factura.pagos.length, 3)
    assert.equal(factura.pagos.find(p => p.id === 'transferencia')?.medioPago, 'transferencia')
    assert.equal(factura.pagos.find(p => p.id === 'transferencia')?.caja, 'Mercado Pago')
    assert.equal(factura.pagos[2].caja, 'Caja Fuerte')
    assert.equal(factura.pagos[2].sedeCaja, 'Villa Elisa')
    assert.equal(factura.pagoSinDetalle, false)
})

test('los históricos agrupan renglones de una factura y cuentan un pago compartido una sola vez', () => {
    const vinculo = { id: 'gasto', movimientosCaja: [pago('comun', 50)] }
    const [factura] = construirHistorialProveedor([], [
        historico({ costoTotal: 100, montoPagado: 20, gasto: vinculo }),
        historico({ id: 'historico-2', costoTotal: 150, montoPagado: 30, gasto: vinculo }),
    ], [])
    assert.equal(factura.total, 250)
    assert.equal(factura.pagado, 50)
    assert.equal(factura.pendiente, 200)
    assert.equal(factura.items.length, 2)
    assert.equal(factura.pagos.length, 1)
    assert.equal(factura.pagoSinDetalle, false)
})

test('no une números históricos reutilizados en fechas o sedes diferentes ni operaciones sin número', () => {
    const facturas = construirHistorialProveedor([], [
        historico(), historico({ id: 'otra-fecha', fecha: new Date('2026-09-21T12:00:00Z') }),
        historico({ id: 'otra-sede', ubicacion: { id: 'local', nombre: 'Local' } }),
        historico({ id: 'sin-numero-1', numeroFactura: null }), historico({ id: 'sin-numero-2', numeroFactura: null }),
    ], [])
    assert.equal(facturas.length, 5)
})

test('conserva históricos pagados sin inventar medio, caja ni fecha de pago', () => {
    const [factura] = construirHistorialProveedor([], [historico({ estadoPago: 'pagado', montoPagado: 0 })], [])
    assert.equal(factura.pagado, 100)
    assert.equal(factura.pendiente, 0)
    assert.equal(factura.estadoPago, 'pagado')
    assert.equal(factura.pagoSinDetalle, true)
    assert.deepEqual(factura.pagos, [])
})

test('sin número, un gasto compartido no oculta destinos ni fechas diferentes', () => {
    const vinculo = { id: 'gasto', movimientosCaja: [pago('pago', 50)] }
    const facturas = construirHistorialProveedor([], [
        historico({ numeroFactura: null, gasto: vinculo }),
        historico({ id: 'otra-sede', numeroFactura: null, gasto: vinculo, ubicacion: { id: 'local', nombre: 'Local' } }),
        historico({ id: 'otra-fecha', numeroFactura: null, gasto: vinculo, fecha: new Date('2026-09-21T12:00:00Z') }),
    ], [])
    assert.equal(facturas.length, 3)
    assert.equal(facturas.find(factura => factura.id === 'otra-sede')?.sede?.nombre, 'Local')
    assert.ok(facturas.every(factura => factura.pagos.length === 0))
})

test('un pago histórico vinculado a distintas facturas se señala sin imputarlo por duplicado', () => {
    const vinculo = { id: 'gasto', movimientosCaja: [pago('compartido', 50)] }
    const facturas = construirHistorialProveedor([], [
        historico({ montoPagado: 20, gasto: vinculo }),
        historico({ id: 'otra', numeroFactura: '11', montoPagado: 30, gasto: vinculo }),
    ], [])
    assert.ok(facturas.every(factura => factura.pagos.length === 0 && factura.pagoSinDetalle))
    assert.equal(resumirHistorialProveedor(facturas).totalPagado, 50)
})

test('no muestra anulaciones, reversas ni ingresos como pagos vigentes y advierte discrepancias', () => {
    const [factura] = construirHistorialProveedor([compra({ gastos: [gasto('gasto', [
        pago('anulado', 10, { estado: 'anulado' }), pago('reversa', 10, { movimientoReversaDeId: 'original' }),
        pago('ingreso', 10, { tipo: 'ingreso' }), pago('vigente', 10),
    ])] })], [], [])
    assert.deepEqual(factura.pagos.map(p => p.id), ['vigente'])
    assert.equal(factura.pagado, 40)
    assert.equal(factura.pagoSinDetalle, true)
})

test('el resumen incluye todo el historial, más de 50 registros, sin sumar otra vez los pagos como costos', () => {
    const facturas = construirHistorialProveedor(Array.from({ length: 61 }, (_, i) => compra({
        id: `compra-${i}`, gastos: [gasto(`gasto-${i}`, [pago(`pago-${i}`, 40)])],
    })), [], [])
    assert.deepEqual(resumirHistorialProveedor(facturas), {
        cantidadFacturas: 61, totalFacturado: 6100, totalPagado: 2440, totalPendiente: 3660, sinDetallePago: 0,
    })
})

test('combina búsqueda, sede, estado y fechas en Argentina, independientemente del día UTC', () => {
    const facturas = construirHistorialProveedor([
        compra({ fechaFactura: new Date('2026-09-29T01:00:00Z') }),
        compra({ id: 'otra', ubicacion: null, gastos: [gasto('otro-pago', [pago('pago-otro', 40)]), compra().gastos[1]] }),
    ], [], [])
    assert.equal(filtrarHistorialProveedor(facturas, { busqueda: 'FABRICA', sede: 'fabrica', estado: 'a_cuenta', desde: '2026-09-28', hasta: '2026-09-28' }).length, 1)
    assert.equal(filtrarHistorialProveedor(facturas, { desde: '2026-09-29' }).length, 0)
    assert.equal(filtrarHistorialProveedor(facturas, { busqueda: 'flete' }).length, 2)
    assert.equal(filtrarHistorialProveedor(facturas, { busqueda: 'Caja Chica' }).length, 2)
    assert.equal(filtrarHistorialProveedor(facturas, { sede: 'sin-sede' }).length, 1)
    assert.equal(filtrarHistorialProveedor(facturas, { estado: 'pagado' }).length, 0)
})
