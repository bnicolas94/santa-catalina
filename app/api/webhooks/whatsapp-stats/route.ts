import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseStatsUpload } from '@/lib/whatsapp-stats'

export const runtime = 'nodejs'

export async function POST(request: Request) {
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,60})$/)?.[1]
    if (!token) return NextResponse.json({ error: 'Credencial inválida' }, { status: 401 })
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const source = await prisma.whatsappStatsSource.findUnique({ where: { tokenHash } })
    if (!source?.activo) return NextResponse.json({ error: 'Credencial inválida' }, { status: 401 })

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 2_000_000) return NextResponse.json({ error: 'Carga demasiado grande' }, { status: 413 })
    let upload: ReturnType<typeof parseStatsUpload>
    try {
        const text = await request.text()
        if (text.length > 2_000_000) throw new Error('Carga demasiado grande')
        upload = parseStatsUpload(JSON.parse(text))
    } catch {
        return NextResponse.json({ error: 'Datos estadísticos inválidos' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
        for (const snapshot of upload.snapshots) {
            await tx.whatsappStatsDaily.upsert({
                where: { sourceId_date: { sourceId: source.id, date: snapshot.date } },
                create: { sourceId: source.id, date: snapshot.date, snapshot },
                update: { snapshot, receivedAt: new Date() },
            })
        }
        if (upload.links.length) {
            await tx.whatsappStatsChatLink.createMany({
                data: upload.links.map((link) => ({ sourceId: source.id, ...link })),
                skipDuplicates: true,
            })
        }
        await tx.whatsappStatsSource.update({ where: { id: source.id }, data: { lastSeenAt: new Date() } })
    })
    return NextResponse.json({ ok: true, days: upload.snapshots.length, links: upload.links.length })
}
