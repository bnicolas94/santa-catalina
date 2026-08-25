import assert from 'node:assert/strict'
import test from 'node:test'

import {
    contenidoEspecialClasico,
    contenidoReciboFinalRenuncia,
    type DatosReciboLiquidacion,
} from '../../components/empleados/recibosLiquidacion'

const reciboRenuncia: DatosReciboLiquidacion = {
    empleado: {
        nombre: 'María',
        apellido: 'Pérez',
        dni: '30111222',
    },
    periodo: 'Liquidación Final (RENUNCIA)',
    tipo: 'FINAL',
    totalNeto: 150000,
    desglose: {
        esLiquidacionFinal: true,
        tipoEgreso: 'RENUNCIA',
        conceptos: [
            {
                nombre: 'Días Trabajados (15 días)',
                monto: 100000,
                metodologia: '(Sueldo / 30) * 15 días trabajados en el mes.',
            },
            {
                nombre: 'SAC proporcional',
                monto: 50000,
                metodologia: 'Detalle permitido para otro concepto.',
            },
        ],
    },
}

test('el recibo de renuncia identifica al empleado, el pago en efectivo y la declaración final', () => {
    const contenido = contenidoReciboFinalRenuncia(reciboRenuncia)

    assert.ok(contenido)
    assert.match(contenido, /Quien suscribe, <strong>María Pérez<\/strong>/)
    assert.match(contenido, /con DNI <strong>30111222<\/strong>/)
    assert.match(contenido, /<strong>\$150\.000<\/strong> \(pesos ciento cincuenta mil\)/)
    assert.match(contenido, /entregada por Eliana Melisa Bassi en efectivo/)
    assert.match(contenido, /tareas realizadas en Sandwicheria Santa Catalina a la fecha/)
    assert.match(contenido, /Días Trabajados \(15 días\)/)
    assert.doesNotMatch(contenido, /\(Sueldo \/ 30\)/)
    assert.match(contenido, /SAC proporcional/)
    assert.match(contenido, /Detalle permitido para otro concepto/)
    assert.match(contenido, /no reservándome acción legal alguna por ejercer/)
    assert.match(contenido, /Recibí/)
})

test('no aplica el texto de renuncia a otras causas de liquidación final', () => {
    const reciboDespido: DatosReciboLiquidacion = {
        ...reciboRenuncia,
        desglose: {
            ...reciboRenuncia.desglose,
            tipoEgreso: 'DESPIDO_SIN_CAUSA',
        },
    }

    assert.equal(contenidoReciboFinalRenuncia(reciboDespido), null)
})

test('escapa el nombre y DNI antes de incorporarlos al recibo', () => {
    const contenido = contenidoReciboFinalRenuncia({
        ...reciboRenuncia,
        empleado: {
            nombre: '<María>',
            apellido: 'Pérez & Cía.',
            dni: '30<111>',
        },
    })

    assert.ok(contenido)
    assert.doesNotMatch(contenido, /<María>/)
    assert.match(contenido, /&lt;María&gt; Pérez &amp; Cía\./)
    assert.match(contenido, /30&lt;111&gt;/)
})

test('el recibo de feriado adeudado documenta sólo el complemento y su semana original', () => {
    const contenido = contenidoEspecialClasico({
        empleado: { nombre: 'María', apellido: 'Pérez', dni: '30111222' },
        periodo: 'Pago de feriado adeudado',
        tipo: 'FERIADO_ADEUDADO',
        montoHorasFeriado: 10_000,
        totalNeto: 10_000,
        desglose: {
            origen: 'FERIADO_ADEUDADO',
            nombreFeriado: 'San Martín',
            fechaFeriado: '2026-08-17',
            semanaOrigen: 'Semana del 17/08/2026 al 23/08/2026',
            monto: 10_000,
        },
    })

    assert.ok(contenido)
    assert.match(contenido, /Recibo de feriado adeudado/)
    assert.match(contenido, /adicional omitido del feriado <strong>San Martín<\/strong>/)
    assert.match(contenido, /<strong>17\/08\/2026<\/strong>/)
    assert.match(contenido, /Total neto recibido/)
    assert.match(contenido, /Semana del 17\/08\/2026 al 23\/08\/2026/)
    assert.match(contenido, /no modifica ni duplica la liquidación salarial original/)
})
