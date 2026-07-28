import assert from 'node:assert/strict'
import test from 'node:test'

import {
    dividirMontoEnCuotas,
    estadoPrestamoDesdeCuotas,
    seleccionarCuotasVencidasPorPrestamo,
    sumarMesesFechaCivil,
    validarCantidadCuotas,
    validarMontoPrestamo,
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
