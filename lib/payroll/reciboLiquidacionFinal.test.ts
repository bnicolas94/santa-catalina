import assert from 'node:assert/strict'
import test from 'node:test'

import {
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
            { nombre: 'Días trabajados', monto: 100000 },
            { nombre: 'SAC proporcional', monto: 50000 },
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
    assert.match(contenido, /Días trabajados/)
    assert.match(contenido, /SAC proporcional/)
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
