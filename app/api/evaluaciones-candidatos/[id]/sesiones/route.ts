import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { json } from '@/lib/evaluacion-candidatos/sesion.server'
import type { Plan, Sesion } from '@/lib/evaluacion-candidatos/tipos'
type Context = { params: Promise<{ id: string }> }
export async function PATCH(request: Request, context: Context) {
    const auth = await autorizarPostulaciones(); if (auth.rechazo) return auth.rechazo
    try {
        const { id } = await context.params, input = await request.json()
        if (!input || typeof input.motivo !== 'string' || input.motivo.trim().length < 5 || input.motivo.length > 500 || !['pausar', 'reanudar'].includes(input.accion)) throw new Error('Ingresá un motivo de 5 a 500 caracteres')
        if (input.accion === 'reanudar' && (!Number.isInteger(input.extra) || input.extra < 30 || input.extra > 3600)) throw new Error('Tiempo adicional: 30 a 3600 segundos')
        await prisma.$transaction(async tx => {
            const inv = await tx.invitacionEvaluacion.findFirst({ where: { candidatoId: id, intento: { id: input.intentoId } } })
            if (!inv || inv.revocadaAt || inv.venceAt <= new Date()) throw new Error('Invitación no disponible')
            await tx.$queryRaw`SELECT "id" FROM "invitaciones_evaluacion" WHERE "id" = ${inv.id} FOR UPDATE`
            const intento = await tx.intentoEvaluacion.findUniqueOrThrow({ where: { id: input.intentoId }, include: { respuestas: true } })
            const plan = intento.plan as unknown as Plan
            if (!plan?.modulos) throw new Error('No es un intento de pruebas prácticas')
            const indice = plan.modulos.findIndex(a => a.modulo === input.modulo), a = plan.modulos[indice]
            const fila = intento.respuestas.find(r => r.modulo === input.modulo)
            if (!a || !fila || plan.modulos.slice(indice + 1).some(a => intento.respuestas.some(r => r.modulo === a.modulo))) throw new Error('Sólo se interviene el último módulo iniciado')
            const s = fila.datos as unknown as Sesion, ahora = Date.now()
            if (input.accion === 'pausar') { if (s.fin || s.pausa) throw new Error('El módulo no está activo'); s.pausa = new Date(ahora).toISOString() }
            else { s.pausadoMs += (s.pausa ? ahora - Date.parse(s.pausa) : 0) + input.extra * 1000; s.pausa = null; s.fin = null; delete s.metricas }
            s.revision++; s.historial.push({ fecha: new Date(ahora).toISOString(), tipo: input.accion.toUpperCase(), detalle: `${auth.id}: ${input.motivo.trim()} · extra ${input.extra || 0}s` })
            await tx.respuestaEvaluacion.update({ where: { id: fila.id }, data: { datos: json(s) } })
            await tx.intentoEvaluacion.update({ where: { id: intento.id }, data: { estado: 'EN_PROGRESO', finAt: null } })
        })
        return NextResponse.json({ ok: true })
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo actualizar' }, { status: 409 }) }
}
