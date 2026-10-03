import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { tienePermisoEnSesion } from '@/lib/auth/permisosSesion'
import { prisma } from '@/lib/prisma'
import { matchCustomersByPhone } from '@/lib/crm/customerPhoneMatch'
import { comparisonRange, daysInRange, parseStatsUpload, summarizeDailySnapshots,
    type ComparisonMode, type DailySnapshot } from '@/lib/whatsapp-stats'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!tienePermisoEnSesion(session, 'permisoReportes')) {
        return NextResponse.json({ error: 'No tenés permiso para consultar reportes' }, { status: 403 })
    }
    const sources = await prisma.whatsappStatsSource.findMany({
        select: { id: true, nombre: true, activo: true, lastSeenAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    })
    const params = new URL(request.url).searchParams
    const source = sources.find((item) => item.id === params.get('sourceId')) || sources.find((item) => item.activo) || sources[0]
    const formatDate = (value: Date) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(value)
    const hasta = params.get('hasta') || formatDate(new Date())
    const desde = params.get('desde') || formatDate(new Date(Date.now() - 6 * 86400000))
    const compareParam = params.get('comparar')
    const comparisonMode: ComparisonMode | null = compareParam === 'previous' || compareParam === 'week' || compareParam === 'month'
        ? compareParam : null
    const start = Date.parse(`${desde}T00:00:00Z`)
    const end = Date.parse(`${hasta}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) ||
        !Number.isFinite(start) || !Number.isFinite(end) || desde > hasta || end - start > 365 * 86400000 ||
        (compareParam !== null && compareParam !== 'none' && !comparisonMode)) {
        return NextResponse.json({ error: 'Elegí un rango de hasta 366 días' }, { status: 400 })
    }
    if (!source) return NextResponse.json({ sources, sourceId: null, desde, hasta,
        totals: null, days: [], matches: [], matching: null })

    const loadDays = async (startDate: string, endDate: string): Promise<DailySnapshot[]> => {
        const rows = await prisma.whatsappStatsDaily.findMany({
            where: { sourceId: source.id, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' },
        })
        const result: DailySnapshot[] = []
        for (const row of rows) {
            try { result.push(parseStatsUpload({ snapshots: [row.snapshot], links: [] }).snapshots[0]) }
            catch { /* un formato futuro no se atribuye a una métrica actual */ }
        }
        return result
    }
    const comparedRange = comparisonMode ? comparisonRange(desde, hasta, comparisonMode) : null
    const [days, comparedDays] = await Promise.all([
        loadDays(desde, hasta), comparedRange ? loadDays(comparedRange.desde, comparedRange.hasta) : Promise.resolve([]),
    ])
    const totals = summarizeDailySnapshots(days)
    const comparison = comparedRange ? {
        mode: comparisonMode, ...comparedRange, totals: summarizeDailySnapshots(comparedDays),
        observedDays: comparedDays.length, expectedDays: daysInRange(comparedRange.desde, comparedRange.hasta),
        days: comparedDays.map(({ uniqueChatIds, ...day }) => ({ ...day, uniqueChats: uniqueChatIds.length })),
    } : null
    const canSeeClients = (session.user as { rol?: string }).rol === 'ADMIN' ||
        tienePermisoEnSesion(session, 'permisoClientes')
    const activeChats = new Set(days.flatMap((day) => day.uniqueChatIds))
    let matches: { chatId: string; clienteId: string; nombreComercial: string; quality: string }[] = []
    let matching: { linked: number; ambiguous: number; withoutMatch: number; withoutPhone: number } | null = null
    if (canSeeClients && activeChats.size) {
        const [links, customers] = await Promise.all([
            prisma.whatsappStatsChatLink.findMany({ where: { sourceId: source.id, chatId: { in: [...activeChats] } } }),
            prisma.cliente.findMany({ where: { contactoTelefono: { not: null } },
                select: { id: true, nombreComercial: true, contactoNombre: true,
                    contactoTelefono: true, direccion: true, zona: true, localidad: true } }),
        ])
        let ambiguous = 0
        let withoutMatch = 0
        for (const link of links) {
            const candidates = matchCustomersByPhone(link.phoneE164, customers)
            if (candidates.length === 1) matches.push({ chatId: link.chatId,
                clienteId: candidates[0].id, nombreComercial: candidates[0].nombreComercial,
                quality: candidates[0].matchQuality })
            else if (candidates.length > 1) ambiguous++
            else withoutMatch++
        }
        matching = { linked: matches.length, ambiguous, withoutMatch,
            withoutPhone: activeChats.size - links.length }
        matches = matches.slice(0, 200)
    }
    return NextResponse.json({ sources, sourceId: source.id, desde, hasta, totals,
        days: days.map(({ uniqueChatIds, ...day }) => ({ ...day, uniqueChats: uniqueChatIds.length })),
        observedDays: days.length, expectedDays: daysInRange(desde, hasta), comparison,
        matches, matching }, { headers: { 'Cache-Control': 'private, no-store' } })
}
