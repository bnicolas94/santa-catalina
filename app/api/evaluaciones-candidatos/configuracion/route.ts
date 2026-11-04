import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { CONFIG_INICIAL, crearPlan } from '@/lib/evaluacion-candidatos/banco.server'
import { validarConfig } from '@/lib/evaluacion-candidatos/motor'
export async function GET() {
    const auth = await autorizarPostulaciones(); if (auth.rechazo) return auth.rechazo
    const fila = await prisma.configuracionGlobal.findUnique({ where: { clave: 'evaluacion_candidatos_v2' } })
    const config = fila ? validarConfig(JSON.parse(fila.valor)) : CONFIG_INICIAL
    const { version, variante, modulos } = crearPlan(config, 0)
    return NextResponse.json({ config, demo: { version, variante, modulos }, variantes: ['A1 / A2: textos equivalentes', 'B1–B4: planillas', 'C1–C12: conversaciones', 'D1–D5: control', 'E1–E4: redacción'] }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function PUT(request: Request) {
    const auth = await autorizarPostulaciones(); if (auth.rechazo) return auth.rechazo
    try {
        const config = validarConfig(await request.json())
        await prisma.configuracionGlobal.upsert({ where: { clave: 'evaluacion_candidatos_v2' }, create: { clave: 'evaluacion_candidatos_v2', valor: JSON.stringify(config) }, update: { valor: JSON.stringify(config) } })
        return NextResponse.json({ ok: true })
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Configuración inválida' }, { status: 400 }) }
}
