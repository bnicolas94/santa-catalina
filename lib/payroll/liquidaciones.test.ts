import assert from 'node:assert/strict'
import test from 'node:test'

import {
    normalizarRangoLiquidacion,
    rangoHistoricoLiquidacion,
    rangosLiquidacionSeSuperponen,
    validarLiquidacionAnulable,
    validarMotivoAnulacionLiquidacion,
} from './liquidaciones'

test('normaliza rangos civiles y detecta superposición', () => {
    const semana = normalizarRangoLiquidacion('2026-07-20', '2026-07-26')
    assert.equal(rangosLiquidacionSeSuperponen(semana, { desde: '2026-07-26', hasta: '2026-08-01' }), true)
    assert.equal(rangosLiquidacionSeSuperponen(semana, { desde: '2026-07-27', hasta: '2026-08-02' }), false)
    assert.throws(() => normalizarRangoLiquidacion('2026-07-27', '2026-07-20'))
})

test('recupera rangos de los formatos históricos conocidos', () => {
    assert.deepEqual(rangoHistoricoLiquidacion('Semana del 20/7/2026 al 26/7/2026'), {
        desde: '2026-07-20', hasta: '2026-07-26',
    })
    assert.deepEqual(rangoHistoricoLiquidacion('Express 20/07/2026 - 26/07/2026'), {
        desde: '2026-07-20', hasta: '2026-07-26',
    })
    assert.deepEqual(rangoHistoricoLiquidacion('Masivo - 2026-02'), {
        desde: '2026-02-01', hasta: '2026-02-28',
    })
    assert.deepEqual(rangoHistoricoLiquidacion('sin fechas', [
        { fecha: '2026-07-22' }, { fecha: '2026-07-20' }, { fecha: '2026-07-26' },
    ]), { desde: '2026-07-20', hasta: '2026-07-26' })
    assert.deepEqual(rangoHistoricoLiquidacion('Vacaciones 2026 (7 días)', {
        fechaInicioGoce: '2026-02-02', fechaFinGoce: '2026-02-08',
    }), { desde: '2026-02-02', hasta: '2026-02-08' })
    assert.deepEqual(rangoHistoricoLiquidacion('SAC 1º Semestre 2026'), {
        desde: '2026-01-01', hasta: '2026-06-30',
    })
})

test('valida anulaciones con Caja trazable y protege las históricas ambiguas', () => {
    const movimiento = {
        tipo: 'egreso', monto: 10_000, cajaOrigen: 'caja_madre', movimientoReversion: null,
    }
    assert.doesNotThrow(() => validarLiquidacionAnulable({
        estado: 'pagado', totalNeto: 10_000, registradaEnCaja: true, movimientos: [movimiento],
    }))
    assert.doesNotThrow(() => validarLiquidacionAnulable({
        estado: 'pagado', totalNeto: 10_000, registradaEnCaja: false, movimientos: [],
    }))
    assert.throws(() => validarLiquidacionAnulable({
        estado: 'pagado', totalNeto: 10_000, registradaEnCaja: null, movimientos: [],
    }))
    assert.throws(() => validarLiquidacionAnulable({
        estado: 'pagado', totalNeto: 9_000, registradaEnCaja: true, movimientos: [movimiento],
    }))
    assert.equal(validarMotivoAnulacionLiquidacion('Pago cargado por duplicado'), 'Pago cargado por duplicado')
    assert.throws(() => validarMotivoAnulacionLiquidacion('corto'))
})
