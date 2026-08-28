import assert from 'node:assert/strict'
import test from 'node:test'

import {
    buscarDiaLiquidado,
    calcularAdicionalFeriadoAdeudado,
    construirDiaFeriadoExpress,
    periodoFeriadoAdeudado,
} from './feriadosAdeudados'

test('recupera el día desde desgloses históricos directos o anidados', () => {
    const dia = { fecha: '2026-08-17', horasTrabajadas: 9, jornalBase: 20_000, valorFeriado: 0 }
    assert.deepEqual(buscarDiaLiquidado([dia], '2026-08-17'), dia)
    assert.deepEqual(buscarDiaLiquidado({ desglosePorDia: [dia] }, '2026-08-17'), dia)
})

test('reconstruye un feriado de una liquidación Express usando fichadas reales', () => {
    const dia = construirDiaFeriadoExpress(
        { origen: 'LIQUIDACION_EXPRESS' },
        '2026-08-17',
        8,
        71_280,
    )

    assert.deepEqual(dia, {
        fecha: '2026-08-17',
        horasTrabajadas: 8,
        jornalBase: 71_280,
        valorDiaBase: 71_280,
        multiplicadorJornal: 1,
        valorFeriado: 0,
    })
    assert.equal(calcularAdicionalFeriadoAdeudado(dia!), 35_640)
})

test('prioriza el jornal guardado en Express y exige trabajo real', () => {
    assert.equal(construirDiaFeriadoExpress({ origen: 'LIQUIDACION_EXPRESS' }, '2026-08-17', 0, 71_280), null)
    assert.equal(
        construirDiaFeriadoExpress({ origen: 'LIQUIDACION_EXPRESS', jornalDiarioSnapshot: 60_000 }, '2026-08-17', 8, 71_280)?.jornalBase,
        60_000,
    )
})

test('calcula sólo el recargo feriado con el jornal histórico de la semana original', () => {
    assert.equal(calcularAdicionalFeriadoAdeudado({
        horasTrabajadas: 8,
        jornalBase: 20_000,
        valorDiaBase: 20_000,
        multiplicadorJornal: 1,
        valorFeriado: 0,
    }), 10_000)
})

test('reconstruye el jornal cuando un desglose histórico no guardó jornalBase', () => {
    assert.equal(calcularAdicionalFeriadoAdeudado({
        horasTrabajadas: 6,
        valorDiaBase: 15_000,
        multiplicadorJornal: 0.75,
        valorFeriado: 0,
    }), 10_000)
})

test('bloquea días no trabajados o cuyo adicional ya fue pagado en la semana', () => {
    assert.throws(() => calcularAdicionalFeriadoAdeudado({ horasTrabajadas: 0, jornalBase: 20_000 }))
    assert.throws(() => calcularAdicionalFeriadoAdeudado({ horasTrabajadas: 8, jornalBase: 20_000, valorFeriado: 10_000 }))
})

test('atribuye el comprobante al feriado y a su semana original', () => {
    assert.equal(
        periodoFeriadoAdeudado('2026-08-17', 'Paso a la Inmortalidad del General San Martín'),
        'Pago de feriado adeudado · Paso a la Inmortalidad del General San Martín · Semana del 17/08/2026 al 23/08/2026',
    )
})
