import assert from 'node:assert/strict'
import test from 'node:test'
import { leerEgresosMP, validarPagoContraReporte } from './mercadopago-reporte'
import { firmarPreviewMP, verificarPreviewMP } from './mercadopago-preview'

const cabecera = 'SOURCE_ID;REAL_AMOUNT;TRANSACTION_DATE;TRANSACTION_TYPE\n'
const csv = cabecera + '123;-11000.00;2026-09-11T16:49:27.000-04:00;SETTLEMENT\n124;12000.00;2026-09-11T16:49:27.000-04:00;SETTLEMENT'
test('selecciona débitos y conserva el instante con zona explícita del reporte', () => {
    assert.deepEqual(leerEgresosMP(csv), [{ id: '123', monto: 11000, fecha: '2026-09-11T20:49:27.000Z' }])
    for (const invalido of [csv + '\n123;-11000;2026-09-11T16:49:27-04:00;SETTLEMENT', csv.replace('-11000.00', '-1.234'), csv.replace('16:49:27.000-04:00', '16:49:27'), csv.replace(';SETTLEMENT', ';REFUND')]) {
        assert.throws(() => leerEgresosMP(invalido))
    }
})
test('la evidencia negativa del reporte permite validar sin payer/collector, sin aceptar contradicciones', () => {
    const fila = leerEgresosMP(csv)[0]
    const pago = { id: '123', status: 'approved', currency_id: 'ARS', payment_method_id: 'account_money', transaction_amount: 11000, date_created: fila.fecha }
    assert.equal(validarPagoContraReporte(pago, fila, 'cuenta'), null)
    for (const cambios of [
        { status: 'refunded' }, { currency_id: 'USD' }, { payment_method_id: 'visa' },
        { collector_id: 'cuenta' }, { payer: { id: 'ajeno' } }, { transaction_amount: 10802 },
        { id: '999' }, { date_created: '2026-09-10T20:49:27Z' }, { operation_type: 'account_fund' },
    ]) assert.notEqual(validarPagoContraReporte({ ...pago, ...cambios }, fila, 'cuenta'), null)
})
test('la preview está firmada, vence y está vinculada al usuario y cuenta', t => {
    const anterior = process.env.NEXTAUTH_SECRET
    process.env.NEXTAUTH_SECRET = 'secreto-de-prueba'
    t.after(() => { if (anterior === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = anterior })
    const datos = { usuarioId: 'admin', cuentaId: 'cuenta', hash: 'hash', vence: Date.now() + 60000, filas: leerEgresosMP(csv) }
    const token = firmarPreviewMP(datos)
    assert.deepEqual(verificarPreviewMP(token, 'admin', 'cuenta'), datos)
    assert.throws(() => verificarPreviewMP(token + 'x', 'admin', 'cuenta'))
    assert.throws(() => verificarPreviewMP(token, 'otro', 'cuenta'))
    assert.throws(() => verificarPreviewMP(token, 'admin', 'otra'))
    assert.throws(() => verificarPreviewMP(firmarPreviewMP({ ...datos, vence: 1 }), 'admin', 'cuenta'))
})
