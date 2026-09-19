import assert from 'node:assert/strict'
import test from 'node:test'

import { calcularResumenCajaExterno, esMovimientoInternoCaja, type MovimientoResumenCaja } from './resumen'

const movimiento = (datos: Partial<MovimientoResumenCaja>): MovimientoResumenCaja => ({
    tipo: 'ingreso',
    concepto: 'venta',
    monto: 0,
    medioPago: 'efectivo',
    ...datos,
})

test('el resumen de Caja suma únicamente ingresos y egresos externos', () => {
    const resumen = calcularResumenCajaExterno([
        movimiento({ monto: 1000 }),
        movimiento({ monto: 500, medioPago: 'transferencia' }),
        movimiento({ tipo: 'egreso', concepto: 'pago_proveedor', monto: 300 }),
        movimiento({ tipo: 'egreso', concepto: 'transferencia_interna', monto: 700 }),
        movimiento({ concepto: 'transferencia_interna', monto: 700 }),
    ])

    assert.deepEqual(resumen, {
        ingresosEfectivo: 1000,
        ingresosTransferencia: 500,
        egresosTotal: 300,
        saldo: 1200,
    })
})

test('todos los movimientos vinculados a un depósito se consideran internos', () => {
    const relaciones = [
        'depositoIngreso',
        'depositoRecepcion',
        'depositoAjuste',
        'depositoAjusteRecepcion',
        'depositoTransferenciaOrigen',
        'depositoTransferenciaDestino',
    ] as const

    for (const relacion of relaciones) {
        assert.equal(esMovimientoInternoCaja(movimiento({ concepto: 'Concepto configurable', [relacion]: { id: 'deposito' } })), true)
    }
    assert.equal(esMovimientoInternoCaja(movimiento({ concepto: 'Depósito diario del local' })), true)
    assert.equal(esMovimientoInternoCaja(movimiento({ concepto: 'Venta externa entregada' })), false)
})
