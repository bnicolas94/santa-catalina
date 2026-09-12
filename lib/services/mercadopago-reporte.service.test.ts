import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '@/lib/prisma'
import { firmarPreviewMP } from '@/lib/mercadopago-preview'
import { confirmarReporteMP } from './mercadopago-reporte.service'

test('crear descuenta una sola vez; vincular conserva saldo y deja auditoría; rechaza coincidencias nuevas y cambios en MP', async t => {
    const variables = ['MP_ACCESS_TOKEN', 'MP_COLLECTOR_ID', 'NEXTAUTH_SECRET'] as const
    const previos = variables.map(k => process.env[k])
    variables.forEach(k => { process.env[k] = k === 'MP_COLLECTOR_ID' ? 'cuenta' : 'prueba' })
    t.after(() => variables.forEach((k, i) => { if (previos[i] === undefined) delete process.env[k]; else process.env[k] = previos[i] }))
    const fila = { id: '123', monto: 11000, fecha: '2026-09-11T20:49:27.000Z' }
    const token = firmarPreviewMP({ usuarioId: 'admin', cuentaId: 'cuenta', vence: Date.now() + 60000, hash: 'hash', filas: [fila] })
    let estado = 'approved'
    t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => Response.json(String(input).endsWith('/users/me') ? { id: 'cuenta' } : {
        id: '123', status: estado, currency_id: 'ARS', payment_method_id: 'account_money', transaction_amount: 11000, date_created: fila.fecha,
    }))
    let existente = false; let candidato = false; let saldo = 50000; let creados = 0; let auditorias = 0; let transacciones = 0
    const tx = {
        $executeRaw: async () => 1,
        movimientoMercadoPago: {
            findUnique: async () => existente ? { id: 'mp', movimientoCajaId: 'mov' } : null,
            create: async ({ data }: { data: { movimientoCajaId: string } }) => { assert.equal(data.movimientoCajaId, 'mov'); existente = true },
        },
        movimientoCaja: {
            findMany: async () => candidato ? [{ id: 'mov', monto: 11000, fecha: new Date(fila.fecha), concepto: 'Pago manual', descripcion: null }] : [],
            create: async ({ data }: { data: Record<string, unknown> }) => { creados++; return { ...data, id: 'mov' } },
        },
        saldoCaja: { upsert: async ({ update }: { update: { saldo: { decrement: number } } }) => { saldo -= update.saldo.decrement } },
        auditoriaMovimientoCaja: { create: async () => { auditorias++ } },
    }
    const original = prisma.$transaction
    prisma.$transaction = (async (fn: (cliente: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
        assert.equal(options.isolationLevel, 'Serializable'); transacciones++; return fn(tx)
    }) as unknown as typeof prisma.$transaction
    t.after(() => { prisma.$transaction = original })
    assert.equal((await confirmarReporteMP(token, [{ id: '123', accion: 'crear' }], 'admin')).descontado, 11000)
    assert.equal((await confirmarReporteMP(token, [{ id: '123', accion: 'crear' }], 'admin')).yaRegistrados, 1)
    assert.equal(saldo, 39000); assert.equal(creados, 1)
    existente = false; candidato = true
    await assert.rejects(confirmarReporteMP(token, [{ id: '123', accion: 'crear' }], 'admin'), /coincidencias/)
    assert.equal(saldo, 39000)
    assert.equal((await confirmarReporteMP(token, [{ id: '123', accion: 'vincular', movimientoId: 'mov' }], 'admin')).vinculados, 1)
    assert.equal(saldo, 39000); assert.equal(creados, 1); assert.equal(auditorias, 2)
    estado = 'refunded'
    const antes = transacciones
    await assert.rejects(confirmarReporteMP(token, [{ id: '123', accion: 'crear' }], 'admin'), /aprobado/)
    assert.equal(transacciones, antes)
})
