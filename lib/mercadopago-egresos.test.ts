import assert from 'node:assert/strict'
import test from 'node:test'
import { montoEgresoMP, sincronizarEgresosMP, type PagoSalienteMP } from './mercadopago-egresos'

const pago: PagoSalienteMP = {
    id: 1, status: 'approved', collector_id: 'destino', payer: { id: 'cuenta' },
    operation_type: 'regular_payment', currency_id: 'ARS', payment_method_id: 'account_money',
    transaction_amount: 1000, transaction_details: { total_paid_amount: 1020, net_received_amount: 950 },
    date_created: '2026-09-11T10:00:00-03:00',
}

test('comercios, servicios y transferencias descuentan el total pagado, no el neto del destinatario', () => {
    for (const operation_type of ['regular_payment', 'money_transfer', 'payment_addition']) {
        assert.equal(montoEgresoMP({ ...pago, operation_type }, 'cuenta'), 1020)
    }
    assert.equal(montoEgresoMP({ ...pago, transaction_details: undefined }, 'cuenta'), 1000)
})

test('no descuenta ingresos, recargas, pagos ajenos, tarjetas externas ni estados no aprobados', () => {
    for (const cambios of [
        { collector_id: 'cuenta' }, { collector_id: undefined }, { payer: undefined },
        { payer: { id: 'otra' } }, { operation_type: 'account_fund' },
        { payment_method_id: 'visa' }, { currency_id: 'USD' }, { status: 'refunded' },
        { status: 'pending' }, { transaction_details: { total_paid_amount: 0 } },
        { transaction_details: { total_paid_amount: Number.NaN } },
    ]) assert.equal(montoEgresoMP({ ...pago, ...cambios }, 'cuenta'), null)
})

test('consulta como pagador, pagina y evita repetir IDs entre páginas o ejecuciones', async () => {
    const registrados = new Set<string>()
    const consultas: URL[] = []
    const fetcher: typeof fetch = async input => {
        const url = new URL(String(input)); consultas.push(url)
        const offset = Number(url.searchParams.get('offset'))
        return Response.json({
            results: offset === 0 ? Array.from({ length: 100 }, (_, id) => ({ ...pago, id })) : [{ ...pago, id: 99 }, { ...pago, id: 100 }],
            paging: { total: 102 },
        })
    }
    const registrar = async (p: PagoSalienteMP, monto: number) => {
        assert.equal(monto, 1020)
        if (registrados.has(String(p.id))) return false
        registrados.add(String(p.id)); return true
    }
    const primero = await sincronizarEgresosMP({ token: 'prueba', cuentaId: 'cuenta', fetcher, registrar })
    assert.equal(primero.newlyAdded, 101)
    assert.equal(primero.complete, true)
    assert.equal(consultas[0].searchParams.get('payer.id'), 'cuenta')
    assert.equal(consultas[1].searchParams.get('offset'), '100')
    assert.equal(consultas[0].searchParams.get('end_date'), consultas[1].searchParams.get('end_date'))
    const segundo = await sincronizarEgresosMP({ token: 'prueba', cuentaId: 'cuenta', fetcher, registrar })
    assert.equal(segundo.newlyAdded, 0)
    assert.equal(segundo.alreadyRecorded, 101)
})

test('un error de API o un formato inválido no se presenta como sincronización exitosa', async () => {
    for (const respuesta of [new Response('', { status: 401 }), Response.json({ error: 'inválido' })]) {
        await assert.rejects(sincronizarEgresosMP({
            token: 'prueba', cuentaId: 'cuenta', fetcher: async () => respuesta,
            registrar: async () => { assert.fail('No debe registrar movimientos') },
        }))
    }
})

test('informa consulta parcial al alcanzar el límite de páginas', async () => {
    const resultado = await sincronizarEgresosMP({
        token: 'prueba', cuentaId: 'cuenta',
        fetcher: async () => Response.json({ results: [pago], paging: { total: 10000 } }),
        registrar: async () => true,
    })
    assert.equal(resultado.complete, false)
    assert.equal(resultado.newlyAdded, 1)
})
