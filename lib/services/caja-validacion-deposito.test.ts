import assert from 'node:assert/strict'
import test from 'node:test'

import { prisma } from '@/lib/prisma'
import { CajaService } from './caja.service'

test('validar y dejar el sobre en Caja Fuerte no vuelve a ingresar ni transfiere el dinero', async t => {
    const movimientos: Array<{ tipo: string; cajaOrigen: string; monto: number }> = []
    const saldos = new Map([['caja_chica', 0], ['caja_fuerte', 500]])
    const depositosActualizados: Record<string, unknown>[] = []
    const tx = {
        $queryRaw: async () => [],
        depositoCaja: {
            findUnique: async () => ({
                id: 'deposito', estado: 'pendiente', montoDeclarado: 500,
                cajaOrigen: 'caja_chica', cajaRecepcion: 'caja_fuerte',
                movimientoIngreso: { tipo: 'egreso' },
            }),
            update: async ({ data }: { data: Record<string, unknown> }) => {
                depositosActualizados.push(data)
                return data
            },
        },
        movimientoCaja: {
            create: async ({ data }: { data: { tipo: string; cajaOrigen: string; monto: number } }) => {
                movimientos.push(data)
                return { ...data, id: `movimiento-${movimientos.length}`, fecha: new Date() }
            },
        },
        saldoCaja: {
            updateMany: async ({ where, data }: { where: { tipo: string }; data: { saldo: { increment?: number; decrement?: number } } }) => {
                const anterior = saldos.get(where.tipo) || 0
                saldos.set(where.tipo, anterior + (data.saldo.increment || 0) - (data.saldo.decrement || 0))
                return { count: 1 }
            },
        },
        auditoriaMovimientoCaja: { create: async () => ({}) },
    }
    const transaccionOriginal = prisma.$transaction
    prisma.$transaction = (async (callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx)) as unknown as typeof prisma.$transaction
    t.after(() => { prisma.$transaction = transaccionOriginal })

    await CajaService.validarDeposito({
        depositoId: 'deposito', montoReal: 500, mantenerEnCajaFuerte: true,
        validadoPorId: 'admin',
    })
    assert.deepEqual(movimientos, [])
    assert.equal(saldos.get('caja_fuerte'), 500)
    assert.equal(depositosActualizados.at(-1)?.cajaDestino, 'caja_fuerte')
    assert.equal(depositosActualizados.at(-1)?.movimientoTransferenciaOrigenId, null)
    assert.equal(depositosActualizados.at(-1)?.movimientoTransferenciaDestinoId, null)

    await CajaService.validarDeposito({
        depositoId: 'deposito', montoReal: 450, mantenerEnCajaFuerte: true,
        validadoPorId: 'admin', observaciones: 'Faltaron cincuenta pesos',
    })
    assert.deepEqual(movimientos.map(({ tipo, cajaOrigen, monto }) => ({ tipo, cajaOrigen, monto })), [
        { tipo: 'ingreso', cajaOrigen: 'caja_chica', monto: 50 },
        { tipo: 'egreso', cajaOrigen: 'caja_fuerte', monto: 50 },
    ])
    assert.equal(saldos.get('caja_chica'), 50)
    assert.equal(saldos.get('caja_fuerte'), 450)
    assert.equal(depositosActualizados.at(-1)?.movimientoTransferenciaOrigenId, null)
    assert.equal(depositosActualizados.at(-1)?.movimientoTransferenciaDestinoId, null)
})
