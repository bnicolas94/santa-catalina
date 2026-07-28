import assert from 'node:assert/strict'
import test from 'node:test'

import { fechasSeguimientoSemanal, validarFechasDesgloseSemanal } from './seguimientoSemanalMixto'

test('conserva los siete días aunque la semana cruce de mes', () => {
    assert.deepEqual(fechasSeguimientoSemanal('2026-07-27', '2026-08-02'), [
        '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30',
        '2026-07-31', '2026-08-01', '2026-08-02',
    ])
})

test('rechaza rangos o detalles que no representen la semana completa', () => {
    assert.throws(() => fechasSeguimientoSemanal('2026-07-27', '2026-08-01'), /siete días/)
    assert.throws(() => validarFechasDesgloseSemanal('2026-07-27', '2026-08-02', [
        { fecha: '2026-07-27' },
    ]), /no coincide/)
})
