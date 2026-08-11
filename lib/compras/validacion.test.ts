import test from 'node:test'
import assert from 'node:assert/strict'
import {
    distribuirMontoPagadoPorCostos,
    distribuirPagoEntreItems,
    estadoPagoDesdeMontos,
    numeroPositivo,
    validarCajaCompra,
    validarPagosDivididos,
    validarIdsEdicionCompra,
} from './validacion'

test('rechaza cantidades negativas, cero y valores no numéricos', () => {
    assert.throws(() => numeroPositivo(-1, 'Cantidad'))
    assert.throws(() => numeroPositivo('0', 'Cantidad'))
    assert.throws(() => numeroPositivo('abc', 'Cantidad'))
})

test('sólo acepta cajas conocidas por el módulo', () => {
    assert.equal(validarCajaCompra('caja_chica'), 'caja_chica')
    assert.throws(() => validarCajaCompra('caja_inventada'))
})

test('los pagos divididos deben coincidir con el monto abonado', () => {
    assert.throws(() => validarPagosDivididos([
        { cajaOrigen: 'caja_chica', monto: 40 },
        { cajaOrigen: 'mercado_pago', monto: 50 },
    ], 100, 'caja_chica'))

    assert.equal(validarPagosDivididos([
        { cajaOrigen: 'caja_chica', monto: 40 },
        { cajaOrigen: 'mercado_pago', monto: 60 },
    ], 100, 'caja_chica').length, 2)
})

test('distribuye un pago de factura según el saldo de cada ítem', () => {
    const distribucion = distribuirPagoEntreItems([
        { id: 'a', costoTotal: 300, montoPagado: 0 },
        { id: 'b', costoTotal: 700, montoPagado: 0 },
    ], 500)

    assert.equal(distribucion.get('a'), 150)
    assert.equal(distribucion.get('b'), 350)
})

test('deriva el estado desde el total y lo efectivamente pagado', () => {
    assert.equal(estadoPagoDesdeMontos(100, 0), 'pendiente')
    assert.equal(estadoPagoDesdeMontos(100, 50), 'a_cuenta')
    assert.equal(estadoPagoDesdeMontos(100, 100), 'pagado')
})

test('la edición integral sólo acepta ítems pertenecientes a la compra y sin duplicados', () => {
    assert.doesNotThrow(() => validarIdsEdicionCompra(['a', 'b'], ['a']))
    assert.throws(() => validarIdsEdicionCompra(['a', 'b'], ['a', 'a']))
    assert.throws(() => validarIdsEdicionCompra(['a', 'b'], ['c']))
})

test('redistribuye el monto ya pagado sin alterar su total', () => {
    const distribucion = distribuirMontoPagadoPorCostos([250, 250, 500], 333.33)
    assert.equal(distribucion.length, 3)
    assert.ok(Math.abs(distribucion.reduce((acc, monto) => acc + monto, 0) - 333.33) < 0.000001)
    assert.throws(() => distribuirMontoPagadoPorCostos([100, 200], 400))
})
