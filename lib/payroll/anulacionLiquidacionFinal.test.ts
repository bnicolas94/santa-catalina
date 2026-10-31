import assert from 'node:assert/strict'
import test from 'node:test'

import { validarLiquidacionFinalAnulable } from './anulacionLiquidacionFinal'

const movimiento = {
    tipo: 'egreso',
    monto: 100000,
    cajaOrigen: 'caja_madre',
    estado: 'activo',
    movimientoReversion: null,
}

test('admite una liquidación final pagada con Caja trazable', () => {
    assert.doesNotThrow(() => validarLiquidacionFinalAnulable({
        estado: 'pagado',
        totalNeto: 100000,
        totalDescuentos: 0,
        movimiento,
        cuotasDescontadas: [],
    }))
})

test('rechaza liquidaciones anuladas, importes distintos o movimientos ya revertidos', () => {
    assert.throws(() => validarLiquidacionFinalAnulable({
        estado: 'anulado', totalNeto: 100000, totalDescuentos: 0, movimiento, cuotasDescontadas: [],
    }))
    assert.throws(() => validarLiquidacionFinalAnulable({
        estado: 'pagado', totalNeto: 90000, totalDescuentos: 0, movimiento, cuotasDescontadas: [],
    }))
    assert.throws(() => validarLiquidacionFinalAnulable({
        estado: 'pagado', totalNeto: 100000, totalDescuentos: 0,
        movimiento: { ...movimiento, movimientoReversion: { id: 'reversa' } }, cuotasDescontadas: [],
    }))
})

test('protege descuentos históricos sin cuotas identificadas', () => {
    assert.throws(() => validarLiquidacionFinalAnulable({
        estado: 'pagado',
        totalNeto: 100000,
        totalDescuentos: 25000,
        movimiento,
        cuotasDescontadas: [],
    }), /revisión manual/)

    assert.doesNotThrow(() => validarLiquidacionFinalAnulable({
        estado: 'pagado',
        totalNeto: 100000,
        totalDescuentos: 25000,
        movimiento,
        cuotasDescontadas: [{ id: 'cuota', monto: 25000 }],
    }))
})
