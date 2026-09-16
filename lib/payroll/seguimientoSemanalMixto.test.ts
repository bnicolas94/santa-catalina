import assert from 'node:assert/strict'
import test from 'node:test'

import { fechasSeguimientoSemanal, seguimientoAbiertoDebeRefrescarAsistencia, validarFechasDesgloseSemanal } from './seguimientoSemanalMixto'

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

test('refresca un seguimiento abierto cuando después aparecen fichadas reales', () => {
    assert.equal(seguimientoAbiertoDebeRefrescarAsistencia(
        { entrada: null, salida: null, horasTrabajadas: 0 },
        { entrada: '08:46', salida: '18:14', horasTrabajadas: 9.47 },
    ), true)
})

test('conserva un ajuste manual aunque las marcas de origen hayan cambiado', () => {
    assert.equal(seguimientoAbiertoDebeRefrescarAsistencia(
        { entrada: '09:00', salida: '18:00', horasTrabajadas: 9, ajusteManual: true },
        { entrada: null, salida: null, horasTrabajadas: 0 },
    ), false)
})
test('refresca horas esperadas cuando cambia la planificación sin borrar ajustes manuales', () => {
    assert.equal(seguimientoAbiertoDebeRefrescarAsistencia({ horasJornada: 9 }, { horasJornada: 8 }), true)
    assert.equal(seguimientoAbiertoDebeRefrescarAsistencia({ horasJornada: 9, ajusteManual: true }, { horasJornada: 8 }), false)
})
