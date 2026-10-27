import assert from 'node:assert/strict'
import test from 'node:test'

import {
    contenidoEspecialClasico,
    contenidoReciboFinalPeriodoPrueba,
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

test('el recibo de despido durante el período de prueba identifica las fechas y limita la constancia al pago recibido', () => {
    const contenido = contenidoReciboFinalPeriodoPrueba({
        empleado: {
            nombre: 'Juan',
            apellido: 'Gómez',
            dni: '40111222',
            fechaIngreso: '2026-07-01',
        },
        periodo: 'Liquidación Final (DESPIDO_SIN_CAUSA)',
        tipo: 'FINAL',
        totalNeto: 225000,
        desglose: {
            esLiquidacionFinal: true,
            tipoEgreso: 'DESPIDO_SIN_CAUSA',
            enPeriodoPrueba: true,
            requierePreavisoPeriodoPrueba: false,
            fechaEgreso: '2026-10-27',
            conceptos: [
                { nombre: 'Días trabajados', monto: 180000 },
                { nombre: 'SAC proporcional', monto: 45000 },
            ],
        },
    })

    assert.ok(contenido)
    assert.match(contenido, /Liquidación final durante período de prueba/)
    assert.match(contenido, /Artículo 92 bis/)
    assert.match(contenido, /Juan Gómez/)
    assert.match(contenido, /40111222/)
    assert.match(contenido, /1\/7\/2026/)
    assert.match(contenido, /27\/10\/2026/)
    assert.match(contenido, /\$225\.000/)
    assert.match(contenido, /no incorpora indemnización por antigüedad, indemnización sustitutiva de preaviso ni integración del mes de despido/)
    assert.match(contenido, /no implica renuncia a derechos laborales/)
})

test('el texto especial de período de prueba sólo aplica al despido sin causa marcado como tal', () => {
    const base: DatosReciboLiquidacion = {
        ...reciboRenuncia,
        desglose: {
            ...reciboRenuncia.desglose,
            tipoEgreso: 'DESPIDO_SIN_CAUSA',
            enPeriodoPrueba: false,
        },
    }

    assert.equal(contenidoReciboFinalPeriodoPrueba(base), null)
    assert.equal(contenidoReciboFinalPeriodoPrueba({
        ...base,
        desglose: { ...base.desglose, tipoEgreso: 'RENUNCIA', enPeriodoPrueba: true },
    }), null)
})

test('el recibo histórico de período de prueba no afirma que el preaviso estaba excluido', () => {
    const contenido = contenidoReciboFinalPeriodoPrueba({
        empleado: { nombre: 'Ana', apellido: 'López', dni: '39111222', fechaIngreso: '2025-10-01' },
        periodo: 'Liquidación Final (DESPIDO_SIN_CAUSA)',
        tipo: 'FINAL',
        totalNeto: 300000,
        desglose: {
            esLiquidacionFinal: true,
            tipoEgreso: 'DESPIDO_SIN_CAUSA',
            enPeriodoPrueba: true,
            requierePreavisoPeriodoPrueba: true,
            fechaEgreso: '2026-02-15',
            conceptos: [],
        },
    })

    assert.ok(contenido)
    assert.match(contenido, /el preaviso se refleja, cuando corresponde, en el detalle precedente/)
    assert.doesNotMatch(contenido, /indemnización sustitutiva de preaviso ni/)
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
