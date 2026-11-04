import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashToken, tokenValido } from '@/lib/postulaciones/token'
import { invitacionAccesible } from './reglas'
import { guardarSesion, planPublico, respuestaInicial, mensajeDisponible, validarLease } from './motor'
import type { Modulo, Plan, Sesion } from './tipos'
export const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v))
type Transaccion = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>
export async function sesionPublica(token: string, input: Record<string, unknown>, transaccion: Transaccion = fn => prisma.$transaction(fn)) {
    if (!tokenValido(token)) throw new Error('Enlace no disponible')
    return transaccion(async tx => {
        const hash = hashToken(token)
        await tx.$queryRaw`SELECT "id" FROM "invitaciones_evaluacion" WHERE "token_hash" = ${hash} FOR UPDATE`
        const inv = await tx.invitacionEvaluacion.findUnique({ where: { tokenHash: hash }, include: { candidato: true, intento: { include: { respuestas: true } } } })
        if (!inv || !invitacionAccesible(inv) || !inv.intento?.plan) throw new Error('Enlace o evaluación no disponible')
        const intento = inv.intento, plan = intento.plan as unknown as Plan
        const sesiones = Object.fromEntries(intento.respuestas.map(r => [r.modulo, r.datos])) as Partial<Record<Modulo, Sesion>>
        const ahora = Date.now(), accion = input.accion
        if (accion !== 'leer') {
            if (typeof input.lease !== 'string' || !tokenValido(input.lease)) throw new Error('Sesión de navegador inválida')
            const leaseHash = hashToken(input.lease)
            validarLease(intento.leaseHash, intento.leaseHasta, leaseHash, accion === 'tomar', ahora)
            await tx.intentoEvaluacion.update({ where: { id: intento.id }, data: { leaseHash, leaseHasta: new Date(ahora + 45000) } })
            if (accion === 'iniciar' || accion === 'guardar' || accion === 'cerrar') {
                if (intento.estado !== 'EN_PROGRESO' && !(accion === 'cerrar' && sesiones[input.modulo as Modulo]?.fin)) throw new Error('La evaluación está cerrada')
                const modulo = input.modulo as Modulo
                const indice = plan.modulos.findIndex(a => a.modulo === modulo), a = plan.modulos[indice]
                if (!a || plan.modulos.slice(0, indice).some(prev => !sesiones[prev.modulo]?.fin)) throw new Error('Completá los módulos anteriores')
                let s = sesiones[modulo]
                if (accion === 'iniciar') s ??= { inicio: new Date(ahora).toISOString(), fin: null, pausa: null, pausadoMs: 0, revision: 0, respuesta: respuestaInicial(a), historial: [{ fecha: new Date(ahora).toISOString(), tipo: 'INICIO', detalle: 'Inicio explícito' }] }
                else { if (!s) throw new Error('Primero iniciá el módulo'); s = guardarSesion(s, a, input.respuesta, Number(input.revision), accion === 'cerrar', ahora) }
                sesiones[modulo] = s
                await tx.respuestaEvaluacion.upsert({ where: { intentoId_modulo: { intentoId: intento.id, modulo } }, create: { intentoId: intento.id, modulo, datos: json(s) }, update: { datos: json(s) } })
                if (intento.estado !== 'COMPLETADO' && plan.modulos.every(m => sesiones[m.modulo]?.fin)) {
                    await tx.intentoEvaluacion.update({ where: { id: intento.id }, data: { estado: 'COMPLETADO', finAt: new Date(ahora) } })
                    intento.estado = 'COMPLETADO'
                }
            } else if (accion !== 'tomar' && accion !== 'latido') throw new Error('Acción inválida')
        }
        const chat = sesiones.CONVERSACIONES
        if (chat && !chat.fin && accion !== 'leer') {
            const entregados = new Set(chat.eventos ?? [])
            const eventos = plan.modulos.find(a => a.modulo === 'CONVERSACIONES')?.ejercicios.flatMap(e => e.mensajes ?? []).filter(m => mensajeDisponible(m, chat, ahora) && !entregados.has(m.id)) ?? []
            if (eventos.length) {
                chat.eventos = [...entregados, ...eventos.map(m => m.id)]
                chat.historial.push(...eventos.map(m => ({ fecha: new Date(ahora).toISOString(), tipo: 'MENSAJE_RECIBIDO', detalle: m.id })))
                await tx.respuestaEvaluacion.update({ where: { intentoId_modulo: { intentoId: intento.id, modulo: 'CONVERSACIONES' } }, data: { datos: json(chat) } })
            }
        }
        return { plan: planPublico(plan, sesiones, ahora), sesiones, ahora: new Date(ahora).toISOString(), estado: intento.estado }
    })
}
