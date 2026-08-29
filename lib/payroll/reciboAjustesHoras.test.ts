import test from 'node:test'
import assert from 'node:assert/strict'
import {
    conceptosDetallados,
    cuerpoModeloA,
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
            detalle: 'Horas incorporadas manualmente a esta liquidación.',
        },
    ])
})

test('el recibo clásico menciona expresamente el ajuste de horas adeudadas', () => {
    const contenido = cuerpoModeloA(recibo)

    assert.match(contenido, /0,5 horas extras de la semana/)
    assert.match(contenido, /2 horas de ajuste \/ adeudadas/)
    assert.match(contenido, /\$13\.472/)
})
