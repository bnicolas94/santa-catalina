import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '@/lib/prisma'
import { guardarCaja } from './cajas-catalogo.service'

test('alta con saldo cero y auditoría; editar nombre/sede no cambia saldo, ID ni movimientos; no borra la caja', async t => {
    const creado = { id: 'id-caja', tipo: 'caja_fija', nombre: 'Mostrador', ubicacionId: 'sede', activo: true, sistema: false, saldo: 0, recibeDepositos: false, conceptoDeposito: 'Depósito diario' }
    let persistido = { ...creado }; const auditorias: unknown[] = []; let historial = 0
    const tx = {
        ubicacion: { findUnique: async () => ({ id: 'sede', activo: true }) },
        saldoCaja: {
            findUniqueOrThrow: async () => persistido,
            create: async ({ data }: { data: typeof creado }) => { assert.equal(data.saldo, 0); assert.match(data.tipo, /^caja_[0-9a-f-]{36}$/); persistido = { ...data, id: 'id-caja' }; return persistido },
            update: async ({ data }: { data: Partial<typeof creado> }) => { assert.equal(data.saldo, undefined); assert.equal(data.tipo, undefined); persistido = { ...persistido, ...data }; return persistido },
        },
        movimientoCaja: { count: async () => historial }, depositoCaja: { count: async () => 0 },
        auditoriaConfiguracionCaja: { create: async ({ data }: { data: { usuarioId: string } }) => { assert.equal(data.usuarioId, 'admin'); auditorias.push(data) } },
    }
    const original = prisma.$transaction
    prisma.$transaction = (async (fn: (cliente: typeof tx) => Promise<unknown>, opciones: { isolationLevel: string }) => { assert.equal(opciones.isolationLevel, 'Serializable'); return fn(tx) }) as unknown as typeof prisma.$transaction
    t.after(() => { prisma.$transaction = original })
    await guardarCaja(creado, 'admin')
    const tipo = persistido.tipo
    historial = 2; persistido.saldo = 1800
    await guardarCaja({ ...creado, nombre: 'Caja Centro' }, 'admin', creado.id)
    assert.equal(persistido.saldo, 1800); assert.equal(persistido.tipo, tipo); assert.equal(auditorias.length, 2)
    await assert.rejects(guardarCaja({ ...creado, activo: false }, 'admin', creado.id), /saldo en cero/)
    await assert.rejects(guardarCaja({ ...creado, ubicacionId: 'otra' }, 'admin', creado.id), /historial/)
    assert.equal(auditorias.length, 2)
})
