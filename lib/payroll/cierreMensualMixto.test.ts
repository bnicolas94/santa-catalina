import assert from 'node:assert/strict'
import test from 'node:test'

import {
    calcularDistribucionMixta,
    estadoCierreDesdePagos,
    periodoMensualCerrable,
    periodoSiguiente,
    rangoMesLiquidacion,
} from './cierreMensualMixto'

test('construye el mes calendario completo, incluso en año bisiesto', () => {
    assert.deepEqual(rangoMesLiquidacion('2026-07'), { desde: '2026-07-01', hasta: '2026-07-31' })
    assert.deepEqual(rangoMesLiquidacion('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' })
    assert.equal(periodoSiguiente('2026-12'), '2027-01')
})

test('sólo permite cerrar un mes calendario terminado', () => {
    assert.equal(periodoMensualCerrable('2026-07', '2026-08-01'), true)
    assert.equal(periodoMensualCerrable('2026-08', '2026-08-01'), false)
})

test('separa transferencia y efectivo sin perder centavos', () => {
    assert.deepEqual(calcularDistribucionMixta(750_000, 600_000), {
        totalDevengado: 750_000,
        transferencia: 600_000,
        efectivo: 150_000,
    })
    assert.throws(() => calcularDistribucionMixta(600_000, 750_000))
})

test('deriva el estado desde los pagos requeridos', () => {
    const distribucion = calcularDistribucionMixta(750_000, 600_000)
    assert.equal(estadoCierreDesdePagos(distribucion, []), 'PENDIENTE')
    assert.equal(estadoCierreDesdePagos(distribucion, [{ medio: 'EFECTIVO', monto: 150_000 }]), 'PARCIAL')
    assert.equal(estadoCierreDesdePagos(distribucion, [
        { medio: 'EFECTIVO', monto: 150_000 },
        { medio: 'TRANSFERENCIA', monto: 600_000 },
    ]), 'PAGADO')
})
