import assert from 'node:assert/strict'
import test from 'node:test'
import { validarIdsDiagnostico, diagnosticarPagoMP } from './mercadopago-diagnostico'
import { idsEgresosReporte } from './mercadopago-diagnostico-input'

test('el reporte selecciona sólo negativos, conserva IDs largos y deduplica', () => {
    assert.deepEqual(idsEgresosReporte('\uFEFFSOURCE_ID;REAL_AMOUNT\n12345678901234567890;-11000.00\n2;15000.00\n12345678901234567890;-11000.00'), ['12345678901234567890'])
    assert.throws(() => idsEgresosReporte('SOURCE_ID;REAL_AMOUNT\n1;abc'))
    assert.throws(() => idsEgresosReporte('ID;MONTO\n1;-5'))
})

test('limita la consulta y rechaza rutas, IDs inválidos o lista vacía', () => {
    for (const ids of [[], ['../users/me'], [1], Array(31).fill('1')]) assert.throws(() => validarIdsDiagnostico(ids))
})

test('informa restricciones del pagador y método sin exponer datos personales', async () => {
    const resultado = await diagnosticarPagoMP('1', 'token', 'cuenta', async () => Response.json({
        id: 1, status: 'approved', currency_id: 'ARS', collector_id: 'destino', payer: { email: 'privado@example.com' },
        payment_method_id: 'available_money', transaction_amount: 11000, date_created: new Date().toISOString(),
    }))
    assert.equal(resultado.consultado, true)
    assert.equal(resultado.motivos.length, 2)
    assert.equal(JSON.stringify(resultado).includes('privado'), false)
})

test('distingue pago inaccesible de fallo temporal de API', async () => {
    for (const status of [403, 404, 429, 500]) {
        const resultado = await diagnosticarPagoMP('1', 'token', 'cuenta', async () => new Response('', { status }))
        assert.equal(resultado.consultado, false)
        assert.match(resultado.motivos[0], new RegExp(String(status)))
    }
})
