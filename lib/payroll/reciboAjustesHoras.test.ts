import test from 'node:test'
import assert from 'node:assert/strict'
import {
    conceptosDetallados,
    cuerpoModeloA,
    importeMostradoEnRecibo,
    type DatosReciboLiquidacion,
} from '../../components/empleados/recibosLiquidacion'

const recibo: DatosReciboLiquidacion = {
    empleado: { nombre: 'Brian', apellido: 'Quiroz', dni: '12345678' },
    periodo: 'Semana del 24/08/2026 al 30/08/2026',
    horasExtras: 0.5,
    ajusteHorasExtras: 2,
    montoHorasExtras: 16_840,
    montoAjusteHorasExtras: 13_472,
    sueldoProporcional: 180_003,
    totalNeto: 196_843,
    desglose: { desglosePorDia: [{ valorExtra: 3_368 }] },
}

test('el recibo detallado informa por separado las horas adeudadas', () => {
    const conceptos = conceptosDetallados(recibo)

    assert.deepEqual(conceptos.slice(1), [
        { nombre: 'Horas extras de la semana (0,5 h)', monto: 3_368 },
        {
            nombre: 'Horas de ajuste / adeudadas (2 h)',
            monto: 13_472,
            detalle: 'Semana de origen: Semana del 17/08/2026 al 23/08/2026',
        },
    ])
})

test('el recibo clásico menciona expresamente el ajuste de horas adeudadas', () => {
    const contenido = cuerpoModeloA(recibo)

    assert.match(contenido, /0,5 horas extras de la semana/)
    assert.match(contenido, /2 horas de ajuste \/ adeudadas/)
    assert.match(contenido, /Semana del 17\/08\/2026 al 23\/08\/2026/)
    assert.doesNotMatch(contenido, /23\/08\/2026<\/strong> del <strong>24\/08\/2026/)
    assert.match(contenido, /\$13\.472/)
})

test('el recibo semanal omite descuentos y muestra el importe previo a descontarlos', () => {
    const conDescuento: DatosReciboLiquidacion = {
        ...recibo,
        descuentos: 20_400,
        montoAdicionales: -1_000,
        conceptos: [{ nombre: 'Otra deducción', monto: -1_000 }],
        totalNeto: 175_443,
    }

    const contenido = cuerpoModeloA(conDescuento)
    assert.equal(importeMostradoEnRecibo(conDescuento), 196_843)
    assert.doesNotMatch(contenido, /descuento|20\.400/i)
    assert.doesNotMatch(contenido, /175\.443|otra deducción/i)
    assert.match(contenido, /importe total a pagar es de <strong>\$196\.843/)
    assert.equal(conceptosDetallados(conDescuento).some(concepto => concepto.monto < 0), false)
})
