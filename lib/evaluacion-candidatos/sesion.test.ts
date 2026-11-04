import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import { sesionPublica as ejecutarSesion } from './sesion.server'
import { CONFIG_INICIAL, crearPlan } from './banco.server'
import { hashToken } from '@/lib/postulaciones/token'
import type { Sesion } from './tipos'

test('recorrido transaccional: token, lease, respuestas, recuperación y cierre único', async () => {
    const token = 'a'.repeat(64), lease = 'b'.repeat(64)
    let reloj = Date.now()
    const plan = crearPlan(CONFIG_INICIAL.map(c => ({ ...c, segundos: 30 })), 0)
    const intento = { id: 'intento', plan, leaseHash: null as string | null, leaseHasta: null as Date | null, estado: 'EN_PROGRESO', finAt: null as Date | null, respuestas: [] as { modulo: string; datos: Sesion }[] }
    const inv = { id: 'invitacion', candidato: { archivadoAt: null }, revocadaAt: null as Date | null, venceAt: new Date('2100-01-01'), intento }
    const tx = {
        $queryRaw: async () => [],
        invitacionEvaluacion: { findUnique: async ({ where }: { where: { tokenHash: string } }) => where.tokenHash === hashToken(token) ? inv : null },
        intentoEvaluacion: { update: async ({ data }: { data: Partial<typeof intento> }) => Object.assign(intento, data) },
        respuestaEvaluacion: {
            upsert: async ({ where, create, update }: { where: { intentoId_modulo: { modulo: string } }; create: { modulo: string; datos: Sesion }; update: { datos: Sesion } }) => {
                const fila = intento.respuestas.find(r => r.modulo === where.intentoId_modulo.modulo)
                if (fila) fila.datos = structuredClone(update.datos); else intento.respuestas.push(structuredClone(create))
            },
            update: async ({ where, data }: { where: { intentoId_modulo: { modulo: string } }; data: { datos: Sesion } }) => { intento.respuestas.find(r => r.modulo === where.intentoId_modulo.modulo)!.datos = structuredClone(data.datos) },
        },
    }
    const sesionPublica = (token: string, input: Record<string, unknown>) => ejecutarSesion(token, input, async fn => fn(tx as unknown as Prisma.TransactionClient))
    const tiempo = mock.method(Date, 'now', () => reloj)
    try {
        await assert.rejects(sesionPublica('c'.repeat(64), { accion: 'leer' }), /no disponible/)
        await sesionPublica(token, { accion: 'tomar', lease })
        assert.equal(intento.respuestas.length, 0, 'Abrir la sesión muestra las instrucciones sin iniciar el reloj de una prueba')
        await assert.rejects(sesionPublica(token, { accion: 'tomar', lease: 'd'.repeat(64) }), /otra sesión/)
        for (const a of plan.modulos) {
            const inicio = await sesionPublica(token, { accion: 'iniciar', lease, modulo: a.modulo })
            const s = inicio.sesiones[a.modulo]!
            reloj += 20000
            const respuesta = structuredClone(s.respuesta)
            if (a.modulo === 'TIPEO') respuesta.texto = 'Texto escrito por candidato'
            if (a.modulo === 'CONVERSACIONES') respuesta.tablas.pedidos[8][3] = '3'
            const guardada = await sesionPublica(token, { accion: 'guardar', lease, modulo: a.modulo, revision: 0, respuesta })
            assert.equal(guardada.sesiones[a.modulo]!.revision, 1)
            const recuperada = await sesionPublica(token, { accion: 'leer' })
            assert.deepEqual(recuperada.sesiones[a.modulo]!.respuesta, respuesta)
            await assert.rejects(sesionPublica(token, { accion: 'guardar', lease, modulo: a.modulo, revision: 0, respuesta }), /versión/)
            const cerrada = await sesionPublica(token, { accion: 'cerrar', lease, modulo: a.modulo, revision: 1, respuesta })
            assert.ok(cerrada.sesiones[a.modulo]!.fin)
            await assert.rejects(sesionPublica(token, { accion: 'guardar', lease, modulo: a.modulo, revision: 2, respuesta }), /cerrad/)
        }
        const fin = intento.finAt?.toISOString()
        reloj += 1000
        await sesionPublica(token, { accion: 'cerrar', lease, modulo: 'ATENCION', revision: 1, respuesta: intento.respuestas.at(-1)!.datos.respuesta })
        assert.equal(intento.estado, 'COMPLETADO'); assert.equal(intento.finAt?.toISOString(), fin)
        assert.equal(intento.respuestas.length, 5)
        inv.revocadaAt = new Date()
        await assert.rejects(sesionPublica(token, { accion: 'latido', lease }), /no disponible/)
    } finally { tiempo.mock.restore() }
})
