import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularPagoHorasAdeudadas, etiquetaSemanaOrigen, semanaLaboralDeOrigen, valorHoraExtraAdeudada } from './horasExtrasAdeudadas'

test('atribuye la deuda a la semana de lunes a domingo que contiene la fecha', () => {
    assert.deepEqual(semanaLaboralDeOrigen('2026-07-22'), { desde: '2026-07-20', hasta: '2026-07-26' })
    assert.equal(etiquetaSemanaOrigen('2026-07-22'), 'Semana del 20/07/2026 al 26/07/2026')
})

test('calcula el valor extra respetando la configuración del empleado', () => {
    assert.equal(valorHoraExtraAdeudada({ valorHoraExtra: 3_000 }), 3_000)
    assert.equal(valorHoraExtraAdeudada({ jornal: 60_000, cicloPago: 'SEMANAL', horasTrabajoDiarias: 10 }), 2_000)
    assert.equal(valorHoraExtraAdeudada({ sueldoBaseMensual: 300_000, horasTrabajoDiarias: 10 }), 2_000)
})

test('calcula el monto en servidor y rechaza cantidades inválidas', () => {
    assert.equal(calcularPagoHorasAdeudadas(4.5, 2_000), 9_000)
    assert.throws(() => calcularPagoHorasAdeudadas(0, 2_000))
    assert.throws(() => calcularPagoHorasAdeudadas(201, 2_000))
})
