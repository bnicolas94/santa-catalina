import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '@/lib/prisma'
import { sincronizarMercadoPago } from './mercadopago.service'

test('un egreso crea movimiento, débito de saldo, vínculo y auditoría en la misma transacción; el reintento no vuelve a descontar', async t => {
    const tokenAnterior = process.env.MP_ACCESS_TOKEN
    const cuentaAnterior = process.env.MP_COLLECTOR_ID
    process.env.MP_ACCESS_TOKEN = 'token-de-prueba'
    process.env.MP_COLLECTOR_ID = 'cuenta'
    t.after(() => {
        if (tokenAnterior === undefined) delete process.env.MP_ACCESS_TOKEN
        else process.env.MP_ACCESS_TOKEN = tokenAnterior
        if (cuentaAnterior === undefined) delete process.env.MP_COLLECTOR_ID
        else process.env.MP_COLLECTOR_ID = cuentaAnterior
    })
    t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [{
        id: 123, status: 'approved', collector_id: 'destino', payer: { id: 'cuenta' },
        currency_id: 'ARS', payment_method_id: 'account_money', payment_type_id: 'account_money',
        transaction_amount: 1000, transaction_details: { total_paid_amount: 1000, net_received_amount: 950 },
        date_created: '2026-09-11T10:00:00-03:00',
    }], paging: { total: 1 } }))
    let existe = false
    let saldo = 5000
    let movimientos = 0
    let auditorias = 0
    let vinculos = 0
    let bloqueos = 0
    const tx = {
        $executeRaw: async () => { bloqueos++; return 1 },
        movimientoMercadoPago: {
            findUnique: async () => existe ? { id: 'mp', movimientoCajaId: 'caja' } : null,
            create: async () => { existe = true; return { id: 'mp' } },
            update: async ({ data }: { data: { movimientoCajaId: string } }) => {
                assert.equal(data.movimientoCajaId, 'caja'); vinculos++
            },
        },
        movimientoCaja: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
                assert.equal(data.tipo, 'egreso')
                assert.equal(data.monto, 1000)
                assert.equal(data.cajaOrigen, 'mercado_pago')
                assert.equal(data.creadoPorId, 'admin')
                movimientos++; return { ...data, id: 'caja' }
            },
        },
        saldoCaja: {
            upsert: async ({ where, update }: { where: { tipo: string }; update: { saldo: { decrement: number } } }) => {
                assert.equal(where.tipo, 'mercado_pago')
                saldo -= update.saldo.decrement
            },
        },
        auditoriaMovimientoCaja: {
            create: async ({ data }: { data: { accion: string; movimientoId: string } }) => {
                assert.equal(data.accion, 'CREACION')
                assert.equal(data.movimientoId, 'caja')
                auditorias++
            },
        },
    }
    const transaccionOriginal = prisma.$transaction
    prisma.$transaction = (async (ejecutar: (cliente: typeof tx) => Promise<unknown>) => ejecutar(tx)) as unknown as typeof prisma.$transaction
    t.after(() => { prisma.$transaction = transaccionOriginal })
    const primera = await sincronizarMercadoPago('admin')
    const segunda = await sincronizarMercadoPago('admin')
    assert.equal(primera.newlyAdded, 1)
    assert.equal(segunda.alreadyRecorded, 1)
    assert.equal(saldo, 4000)
    assert.equal(movimientos, 1)
    assert.equal(auditorias, 1)
    assert.equal(vinculos, 1)
    assert.equal(bloqueos, 2)
})
