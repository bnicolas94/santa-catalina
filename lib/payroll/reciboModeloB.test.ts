import assert from 'node:assert/strict'
import test from 'node:test'
import {
    conceptosDetallados,
    cuerpoModeloA,
    cuerpoModeloB,
    type DatosReciboLiquidacion,
} from '@/components/empleados/recibosLiquidacion'

const reciboSemanal: DatosReciboLiquidacion = {
    empleado: {
        nombre: 'Ana',
        apellido: 'Pérez',
        dni: '30111222',
        fechaIngreso: '2024-03-11',
    },
    periodo: 'SEMANAL del 19/10/2026 al 25/10/2026',
    fechaGeneracion: '2026-10-24',
    sueldoProporcional: 180_000,
    montoHorasFeriado: 30_000,
    horasFeriado: 8,
    totalNeto: 210_000,
    desglose: [{
        fecha: '2026-10-20',
        esFeriado: true,
        nombreFeriado: 'Día de prueba',
        horasTrabajadas: 8,
        valorFeriado: 30_000,
    }],
}

test('el Modelo B identifica empleado, ingreso y semana liquidada', () => {
    const html = cuerpoModeloB(reciboSemanal)

    assert.match(html, /RECIBO DE PAGO SEMANAL/)
    assert.match(html, /Semana del 19\/10\/2026 al 25\/10\/2026/)
    assert.match(html, /Ana Pérez/)
    assert.match(html, /30111222/)
    assert.match(html, /11\/3\/2024/)
    assert.match(html, /semana de trabajo comprendida entre el <strong>19\/10\/2026<\/strong> y el <strong>25\/10\/2026<\/strong>/)
    assert.match(html, /no implica renuncia a derechos laborales/)
})

test('el Modelo B separa el feriado sin duplicarlo en el sueldo base', () => {
    const conceptos = conceptosDetallados(reciboSemanal)

    assert.deepEqual(conceptos, [
        { nombre: 'Sueldo / período', monto: 180_000 },
        {
            nombre: 'Feriado trabajado · Día de prueba',
            monto: 30_000,
            detalle: 'Fecha: 20/10/2026',
            unidades: '1 día',
            valorUnitario: 30_000,
        },
    ])

    const html = cuerpoModeloB(reciboSemanal)
    assert.match(html, /<th>Unidades<\/th><th>Valor unitario<\/th><th>Importe<\/th>/)
    assert.match(html, /Feriado trabajado · Día de prueba/)
    assert.match(html, /1 día/)
    assert.match(html, /\$30\.000/)
    assert.match(html, /Importe total a pagar/)
    assert.match(html, /\$210\.000/)
})

test('el Modelo A detalla el feriado dentro de su leyenda narrativa', () => {
    const html = cuerpoModeloA(reciboSemanal)

    assert.match(html, /1 día feriado trabajado/)
    assert.match(html, /Día de prueba/)
    assert.match(html, /20\/10\/2026/)
    assert.match(html, /valor unitario: <strong>\$30\.000/)
    assert.match(html, /semana de trabajo comprendida entre el <strong>19\/10\/2026<\/strong> y el <strong>25\/10\/2026/)
})

test('ambos modelos identifican los días pagos por enfermedad sin duplicar su jornal', () => {
    const reciboEnfermedad: DatosReciboLiquidacion = {
        ...reciboSemanal,
        sueldoProporcional: 200_000,
        montoHorasFeriado: 0,
        horasFeriado: 0,
        totalNeto: 200_000,
        desglose: [
            {
                fecha: '2026-10-19',
                tipoInasistencia: 'JUSTIFICADA_PAGA',
                motivoInasistencia: 'Enfermedad',
                valorDiaBase: 20_000,
            },
            {
                fecha: '2026-10-20',
                tipoInasistencia: 'JUSTIFICADA_PAGA',
                motivoInasistencia: 'Enfermedad',
                valorDiaBase: 20_000,
            },
        ],
    }

    assert.deepEqual(conceptosDetallados(reciboEnfermedad), [
        { nombre: 'Sueldo / período', monto: 160_000 },
        {
            nombre: 'Licencia paga por enfermedad',
            monto: 20_000,
            detalle: 'Fecha: 19/10/2026',
            unidades: '1 día',
            valorUnitario: 20_000,
        },
        {
            nombre: 'Licencia paga por enfermedad',
            monto: 20_000,
            detalle: 'Fecha: 20/10/2026',
            unidades: '1 día',
            valorUnitario: 20_000,
        },
    ])

    const modeloA = cuerpoModeloA(reciboEnfermedad)
    const modeloB = cuerpoModeloB(reciboEnfermedad)
    assert.equal((modeloA.match(/1 día de licencia paga por enfermedad/g) || []).length, 2)
    assert.equal((modeloB.match(/Licencia paga por enfermedad/g) || []).length, 2)
    assert.match(modeloA, /19\/10\/2026/)
    assert.match(modeloA, /20\/10\/2026/)
    assert.match(modeloB, /\$160\.000/)
    assert.match(modeloB, /\$200\.000/)
})

