import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { autorizarPostulaciones } from '@/lib/postulaciones/auth'
import { validarCandidato } from '@/lib/evaluacion-candidatos/reglas'

const base = Prisma.sql`FROM "candidatos_evaluacion" c
    LEFT JOIN LATERAL (
      SELECT i."id", i."createdAt", i."vence_at", i."revocada_at", t."inicio_at", t."fin_at", t."estado"
      FROM "invitaciones_evaluacion" i LEFT JOIN "intentos_evaluacion" t ON t."invitacion_id" = i."id"
      WHERE i."candidato_id" = c."id" ORDER BY i."createdAt" DESC, i."id" DESC LIMIT 1
    ) u ON true`
const estadoSql = Prisma.sql`CASE WHEN u."revocada_at" IS NOT NULL THEN 'REVOCADA' WHEN u."vence_at" <= CURRENT_TIMESTAMP THEN 'VENCIDA' WHEN u."inicio_at" IS NOT NULL THEN 'UTILIZADA' ELSE 'PENDIENTE' END`

export async function GET(request: Request) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    const url = new URL(request.url)
    const pagina = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get('pagina') || '1') || 1))
    const busqueda = (url.searchParams.get('q') || '').trim().slice(0, 100)
    const estado = url.searchParams.get('estado') || ''
    const orden = url.searchParams.get('orden') === 'nombre' ? 'nombre' : 'recientes'
    const condiciones = [Prisma.sql`c."archivado_at" IS NULL`]
    if (busqueda) condiciones.push(Prisma.sql`(c."nombre" ILIKE ${`%${busqueda}%`} OR c."apellido" ILIKE ${`%${busqueda}%`})`)
    if (['PENDIENTE', 'UTILIZADA', 'VENCIDA', 'REVOCADA'].includes(estado)) condiciones.push(Prisma.sql`u."id" IS NOT NULL AND ${estadoSql} = ${estado}`)
    if (estado === 'EN_PROGRESO' || estado === 'COMPLETADO') condiciones.push(Prisma.sql`u."estado" = ${estado}`)
    const where = Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
    const ordenSql = orden === 'nombre' ? Prisma.sql`c."apellido" ASC, c."nombre" ASC, c."id" ASC` : Prisma.sql`c."createdAt" DESC, c."id" DESC`
    const [conteo, candidatos, total, pendientes, iniciadas, completadas, vencidas, revocadas] = await Promise.all([
        prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`SELECT count(*) AS total ${base} ${where}`),
        prisma.$queryRaw(Prisma.sql`SELECT c."id", c."nombre", c."apellido", c."telefono", c."email", c."createdAt", u."id" AS "invitacionId", u."createdAt" AS "invitacionAt", u."vence_at" AS "venceAt", u."inicio_at" AS "inicioAt", u."fin_at" AS "finAt", u."estado" AS "intentoEstado", CASE WHEN u."id" IS NULL THEN NULL ELSE ${estadoSql} END AS "invitacionEstado" ${base} ${where} ORDER BY ${ordenSql} LIMIT 20 OFFSET ${(pagina - 1) * 20}`),
        prisma.candidatoEvaluacion.count(),
        prisma.invitacionEvaluacion.count({ where: { revocadaAt: null, venceAt: { gt: new Date() }, intento: null } }),
        prisma.intentoEvaluacion.count({ where: { estado: 'EN_PROGRESO' } }),
        prisma.intentoEvaluacion.count({ where: { estado: 'COMPLETADO' } }),
        prisma.invitacionEvaluacion.count({ where: { revocadaAt: null, venceAt: { lte: new Date() } } }),
        prisma.invitacionEvaluacion.count({ where: { revocadaAt: { not: null } } }),
    ])
    return NextResponse.json({ candidatos, totalFiltrado: Number(conteo[0].total), pagina, porPagina: 20, resumen: { total, pendientes, iniciadas, completadas, vencidas, revocadas } }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
    const auth = await autorizarPostulaciones()
    if (auth.rechazo) return auth.rechazo
    try {
        const datos = validarCandidato(await request.json())
        const candidato = await prisma.candidatoEvaluacion.create({ data: datos })
        return NextResponse.json({ id: candidato.id }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Datos inválidos' }, { status: 400 })
    }
}
