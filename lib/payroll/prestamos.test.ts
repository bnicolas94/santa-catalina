import assert from 'node:assert/strict'
import test from 'node:test'

import {
    dividirMontoEnCuotas,
    estadoPrestamoDesdeCuotas,
    planificarCancelacionPrestamo,
    seleccionarCuotasVencidasPorPrestamo,
    sumarMesesFechaCivil,
    validarCantidadCuotas,
    validarMontoPrestamo,
    validarMotivoAnulacionPrestamo,
    validarPrestamoAnulable,
} from './prestamos'

test('divide el préstamo sin perder centavos', () => {
    const cuotas = dividirMontoEnCuotas(10_000, 3)
    assert.deepEqual(cuotas, [3333.33, 3333.33, 3333.34])
    assert.equal(cuotas.reduce((total, monto) => total + monto, 0), 10_000)
})

test('valida monto y cantidad de cuotas', () => {
    assert.equal(validarMontoPrestamo('12500.25'), 12500.25)
    assert.equal(validarCantidadCuotas('12'), 12)
    assert.throws(() => validarMontoPrestamo(0))
    assert.throws(() => validarMontoPrestamo(Number.NaN))
    assert.throws(() => validarCantidadCuotas(2.5))
    assert.throws(() => validarCantidadCuotas(61))
})

test('suma meses respetando el último día disponible', () => {
    assert.equal(sumarMesesFechaCivil('2026-01-31', 1), '2026-02-28')
    assert.equal(sumarMesesFechaCivil('2028-01-31', 1), '2028-02-29')
    assert.throws(() => sumarMesesFechaCivil('2026-02-31', 1))
})

test('elige sólo la primera cuota vencida de cada préstamo', () => {
    const fin = new Date('2026-07-27T03:00:00.000Z')
    const cuotas = seleccionarCuotasVencidasPorPrestamo([
        { id: 'a2', prestamoId: 'a', numeroCuota: 2, monto: 100, estado: 'pendiente', fechaVencimiento: '2026-07-20T03:00:00.000Z' },
        { id: 'a1', prestamoId: 'a', numeroCuota: 1, monto: 100, estado: 'pendiente', fechaVencimiento: '2026-07-13T03:00:00.000Z' },
        { id: 'b1', prestamoId: 'b', numeroCuota: 1, monto: 200, estado: 'pendiente', fechaVencimiento: '2026-07-28T03:00:00.000Z' },
        { id: 'c1', prestamoId: 'c', numeroCuota: 1, monto: 300, estado: 'pagada', fechaVencimiento: '2026-07-10T03:00:00.000Z' },
        { id: 'd1', prestamoId: 'd', numeroCuota: 1, monto: 400, estado: 'pendiente', fechaVencimiento: '2026-07-10T03:00:00.000Z', liquidacionId: 'liq' },
    ], fin)

    assert.deepEqual(cuotas.map(cuota => cuota.id), ['a1'])
})

test('deriva el estado desde las cuotas reales y no desde el valor histórico', () => {
    assert.equal(estadoPrestamoDesdeCuotas([{ estado: 'pagada' }, { estado: 'pendiente' }]), 'activo')
    assert.equal(estadoPrestamoDesdeCuotas([{ estado: 'pagada' }]), 'saldado')
})

test('valida una anulación trazable sin cuotas liquidadas', () => {
    assert.doesNotThrow(() => validarPrestamoAnulable({
        estado: 'activo',
        origenEntrega: 'caja_chica',
        cuotas: [
            { estado: 'pendiente', liquidacionId: null, origenEntrega: null },
            { estado: 'pendiente', liquidacionId: null, origenEntrega: 'mercaderia' },
        ],
        movimientos: [{ tipo: 'egreso', cajaOrigen: 'caja_chica', movimientoReversion: null }],
    }))
    assert.equal(validarMotivoAnulacionPrestamo('Carga duplicada del préstamo'), 'Carga duplicada del préstamo')
})

test('cancela sólo el saldo cuando el préstamo ya tiene cuotas descontadas', () => {
    assert.deepEqual(planificarCancelacionPrestamo([
        { estado: 'pagada', monto: 1_000, liquidacionId: 'liq-1' },
        { estado: 'pendiente', monto: 1_000, liquidacionId: null },
        { estado: 'pendiente', monto: 1_000.25, liquidacionId: null },
    ]), {
        tipo: 'cancelacion_saldo',
        cantidadCuotas: 2,
        monto: 2_000.25,
    })
})

test('mantiene la anulación total cuando ninguna cuota fue aplicada', () => {
    assert.deepEqual(planificarCancelacionPrestamo([
        { estado: 'pendiente', monto: 500, liquidacionId: null },
    ]), {
        tipo: 'anulacion_total',
        cantidadCuotas: 1,
        monto: 500,
    })
    assert.throws(() => planificarCancelacionPrestamo([
        { estado: 'pagada', monto: 500, liquidacionId: 'liq-1' },
    ]), /no tiene cuotas pendientes/)
})

test('bloquea préstamos históricos, pagados o con Caja incompleta', () => {
    const base = {
        estado: 'activo',
        origenEntrega: 'caja_chica',
        cuotas: [{ estado: 'pendiente', liquidacionId: null, origenEntrega: null }],
        movimientos: [{ tipo: 'egreso', cajaOrigen: 'caja_chica', movimientoReversion: null }],
    }
    assert.throws(() => validarPrestamoAnulable({ ...base, origenEntrega: null }))
    assert.throws(() => validarPrestamoAnulable({ ...base, cuotas: [{ estado: 'pagada', liquidacionId: 'liq', origenEntrega: null }] }))
    assert.throws(() => validarPrestamoAnulable({ ...base, movimientos: [] }))
    assert.throws(() => validarMotivoAnulacionPrestamo('corto'))
})
