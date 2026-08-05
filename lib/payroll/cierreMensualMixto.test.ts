import assert from 'node:assert/strict'
import test from 'node:test'

import {
    calcularDistribucionMixta,
    consolidarDevengadoMensual,
    estadoCierreDesdePagos,
    montoEfectivoReciboMixto,
    montoDevengadoReferenciaEnPeriodo,
    resolverConciliacionSemanal,
    periodoMensualCerrable,
    periodoSiguiente,
    rangoMesLiquidacion,
} from './cierreMensualMixto'

test('el recibo mixto toma sólo los pagos efectivos vigentes', () => {
    assert.equal(montoEfectivoReciboMixto({
        efectivoCalculado: 150_000,
        pagos: [
            { medio: 'TRANSFERENCIA', monto: 600_000, estado: 'PAGADO' },
            { medio: 'EFECTIVO', monto: 120_000, estado: 'PAGADO' },
            { medio: 'EFECTIVO', monto: 30_000, estado: 'PAGADO' },
            { medio: 'EFECTIVO', monto: 50_000, estado: 'ANULADO' },
        ],
    }), 150_000)
})

test('el recibo mixto usa el efectivo calculado cuando no hay detalle de pagos', () => {
    assert.equal(montoEfectivoReciboMixto({ efectivoCalculado: 75_000 }), 75_000)
    assert.equal(montoEfectivoReciboMixto({ efectivoCalculado: 0 }), 0)
    assert.equal(montoEfectivoReciboMixto(null), 0)
})

test('construye el mes calendario completo, incluso en año bisiesto', () => {
    assert.deepEqual(rangoMesLiquidacion('2026-07'), { desde: '2026-07-01', hasta: '2026-07-31' })
    assert.deepEqual(rangoMesLiquidacion('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' })
    assert.equal(periodoSiguiente('2026-12'), '2027-01')
})

test('sólo permite cerrar un mes calendario terminado', () => {
    assert.equal(periodoMensualCerrable('2026-07', '2026-08-01'), true)
    assert.equal(periodoMensualCerrable('2026-08', '2026-08-01'), false)
})

test('separa transferencia y efectivo sin perder centavos', () => {
    assert.deepEqual(calcularDistribucionMixta(750_000, 600_000), {
        totalDevengado: 750_000,
        transferencia: 600_000,
        efectivo: 150_000,
    })
    assert.throws(() => calcularDistribucionMixta(600_000, 750_000))
})

test('descuenta pagos semanales conciliados sólo del efectivo pendiente', () => {
    assert.deepEqual(calcularDistribucionMixta(750_000, 600_000, 100_000), {
        totalDevengado: 750_000,
        transferencia: 600_000,
        efectivo: 50_000,
    })
    assert.throws(() => calcularDistribucionMixta(750_000, 600_000, 160_000))
})

test('clasifica todas las liquidaciones y permite aplicar importes parciales al mes', () => {
    const referencias = [
        { id: 'semana-1', montoPagado: 100_000 },
        { id: 'semana-2', montoPagado: 50_000 },
    ]
    assert.deepEqual(resolverConciliacionSemanal(referencias, [
        { id: 'semana-1', monto: 75_000 },
        { id: 'semana-2', monto: 0 },
    ]), {
        total: 75_000,
        liquidaciones: [
            { id: 'semana-1', montoPagado: 100_000, montoConciliado: 75_000 },
            { id: 'semana-2', montoPagado: 50_000, montoConciliado: 0 },
        ],
    })
    assert.throws(() => resolverConciliacionSemanal(referencias, [{ id: 'semana-1', monto: 100_000 }]))
    assert.throws(() => resolverConciliacionSemanal(referencias, [
        { id: 'semana-1', monto: 110_000 },
        { id: 'semana-2', monto: 0 },
    ]))
})

test('prorratea una semana que cruza de mes usando el detalle diario', () => {
    const monto = montoDevengadoReferenciaEnPeriodo({
        id: 'semana-cruzada',
        totalNeto: 600,
        rango: { desde: '2026-06-29', hasta: '2026-07-05' },
        desglose: [
            { fecha: '2026-06-29', totalDia: 100 },
            { fecha: '2026-06-30', totalDia: 100 },
            { fecha: '2026-07-01', totalDia: 100 },
            { fecha: '2026-07-02', totalDia: 100 },
            { fecha: '2026-07-03', totalDia: 100 },
            { fecha: '2026-07-04', totalDia: 100 },
            { fecha: '2026-07-05', totalDia: 0 },
        ],
    }, { desde: '2026-07-01', hasta: '2026-07-31' }, 'Lunes a Sábado')

    assert.equal(monto, 400)
})

test('prorratea un Express histórico por jornadas laborales configuradas', () => {
    const monto = montoDevengadoReferenciaEnPeriodo({
        id: 'express-cruzado',
        totalNeto: 600,
        rango: { desde: '2026-06-29', hasta: '2026-07-05' },
        desglose: { sueldoBase: 600, diasTrabajados: 6 },
    }, { desde: '2026-07-01', hasta: '2026-07-31' }, 'Lunes a Sábado')

    assert.equal(monto, 400)

    const conDomingoConfigurado = montoDevengadoReferenciaEnPeriodo({
        id: 'express-seis-dias',
        totalNeto: 600,
        rango: { desde: '2026-06-29', hasta: '2026-07-05' },
        desglose: { sueldoBase: 600, diasTrabajados: 6 },
    }, { desde: '2026-07-01', hasta: '2026-07-31' }, 'Lunes a Domingo')
    assert.equal(conDomingoConfigurado, 400)
})

test('consolida historial semanal y sólo suma días actuales no cubiertos', () => {
    const consolidado = consolidarDevengadoMensual({
        periodo: { desde: '2026-07-01', hasta: '2026-07-31' },
        diasActuales: [
            { fecha: '2026-07-01', totalDia: 100 },
            { fecha: '2026-07-08', totalDia: 125 },
        ],
        descuentoPendiente: 25,
        referencias: [{
            id: 'semana-1',
            totalNeto: 400,
            rango: { desde: '2026-06-29', hasta: '2026-07-05' },
            montoDevengadoPeriodo: 300,
        }],
    })

    assert.deepEqual(consolidado, {
        totalDevengado: 400,
        historicoSemanal: 300,
        seguimientoNoCubierto: 125,
        descuentoPendiente: 25,
        diasCubiertosPorHistorial: 5,
    })
})

test('deriva el estado desde los pagos requeridos', () => {
    const distribucion = calcularDistribucionMixta(750_000, 600_000)
    assert.equal(estadoCierreDesdePagos(distribucion, []), 'PENDIENTE')
    assert.equal(estadoCierreDesdePagos(distribucion, [{ medio: 'EFECTIVO', monto: 150_000 }]), 'PARCIAL')
    assert.equal(estadoCierreDesdePagos(distribucion, [
        { medio: 'EFECTIVO', monto: 150_000 },
        { medio: 'TRANSFERENCIA', monto: 600_000 },
    ]), 'PAGADO')
})
