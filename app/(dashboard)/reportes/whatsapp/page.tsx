'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type Source = { id: string; nombre: string; activo: boolean; lastSeenAt: string | null }
type Day = { date: string; incomingMessages: number; outgoingMessages: number;
    uniqueChats: number; newIncomingChats: number; hourlyIncoming: number[]; hourlyChats: number[];
    response: { answered: number; pendingChats: number; medianMinutes: number | null;
        within15Percent: number | null }; hourlyResponse: { answered: number; medianMinutes: number | null }[] }
type Report = { sources: Source[]; sourceId: string | null; desde: string; hasta: string;
    totals: { incomingMessages: number; outgoingMessages: number; uniqueChats: number;
        newIncomingChats: number; answered: number; pendingChats: number;
        hourlyIncoming: number[]; hourlyChats: number[] } | null;
    days: Day[]; matches: { clienteId: string; nombreComercial: string; quality: string }[];
    matching: { linked: number; ambiguous: number; withoutMatch: number; withoutPhone: number } | null }

const card: React.CSSProperties = { background: 'var(--card-bg, #fff)', border: '1px solid #d4d8e0',
    borderRadius: 12, padding: 18 }
const format = (number: number) => number.toLocaleString('es-AR')

export default function WhatsappReportPage() {
    const { data: session } = useSession()
    const isAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [report, setReport] = useState<Report | null>(null)
    const [sourceId, setSourceId] = useState('')
    const [desde, setDesde] = useState('')
    const [hasta, setHasta] = useState('')
    const [nombre, setNombre] = useState('PC WhatsApp')
    const [token, setToken] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams()
            if (sourceId) query.set('sourceId', sourceId)
            if (desde) query.set('desde', desde)
            if (hasta) query.set('hasta', hasta)
            const response = await fetch(`/api/reportes/whatsapp?${query}`, { cache: 'no-store' })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'No se pudo consultar el reporte')
            setReport(body)
            setError('')
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Error de consulta') }
        finally { setLoading(false) }
    }, [sourceId, desde, hasta])
    useEffect(() => { void load() }, [load])

    async function createSource() {
        setError('')
        const response = await fetch('/api/reportes/whatsapp/conexiones', { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })
        const body = await response.json()
        if (!response.ok) { setError(body.error || 'No se pudo crear la conexión'); return }
        setToken(body.token)
        setSourceId(body.id)
        void load()
    }

    async function revokeSource(id: string) {
        const response = await fetch(`/api/reportes/whatsapp/conexiones/${id}`, { method: 'DELETE' })
        if (!response.ok) { setError('No se pudo revocar la conexión'); return }
        setToken('')
        void load()
    }

    const maxHourly = Math.max(1, ...(report?.totals?.hourlyIncoming || []))
    return <div style={{ padding: 24, display: 'grid', gap: 20 }}>
        <div><Link href="/reportes">← Reportes</Link><h1>WhatsApp · Estadísticas</h1>
            <p>Datos observados por la extensión. La cobertura depende de que WhatsApp Web y la computadora permanezcan activos.</p></div>
        <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <label>Computadora<br/><select value={sourceId || report?.sourceId || ''} onChange={(event) => setSourceId(event.target.value)}>
                {(report?.sources || []).map((source) => <option key={source.id} value={source.id}>
                    {source.nombre}{source.activo ? '' : ' · revocada'}</option>)}
            </select></label>
            <label>Desde<br/><input type="date" value={desde || report?.desde || ''} onChange={(event) => setDesde(event.target.value)}/></label>
            <label>Hasta<br/><input type="date" value={hasta || report?.hasta || ''} onChange={(event) => setHasta(event.target.value)}/></label>
            <button onClick={() => void load()} disabled={loading}>Actualizar</button>
            <span>{loading ? 'Cargando…' : report?.sources.find((source) => source.id === report.sourceId)?.lastSeenAt
                ? `Última conexión: ${new Date(report.sources.find((source) => source.id === report.sourceId)!.lastSeenAt!).toLocaleString('es-AR')}` : 'Sin sincronización'}</span>
        </div>
        {error && <p role="alert" style={{ color: '#c62828' }}>{error}</p>}
        {report?.totals && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                {[
                    ['Clientes atendidos', report.totals.uniqueChats], ['Mensajes entrantes', report.totals.incomingMessages],
                    ['Chats nuevos observados', report.totals.newIncomingChats], ['Mensajes salientes', report.totals.outgoingMessages],
                    ['Tandas respondidas', report.totals.answered], ['Chats aún sin respuesta', report.totals.pendingChats],
                ].map(([label, value]) => <div key={label} style={card}><div>{label}</div><strong style={{ fontSize: 28 }}>{format(Number(value))}</strong></div>)}
            </div>
            <section style={card}><h2>Actividad por hora</h2><p>Pasá el cursor sobre una barra para ver los mensajes y chats de la franja.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,minmax(22px,1fr))', gap: 5, height: 180, alignItems: 'end' }}>
                    {report.totals.hourlyIncoming.map((count, hour) => <div key={hour} title={`${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00 · ${count} mensajes · ${report.totals!.hourlyChats[hour]} chats`}
                        style={{ height: `${Math.max(2, count / maxHourly * 150)}px`, background: '#f97316', borderRadius: 4 }} />)}
                </div><div style={{ display: 'flex', justifyContent: 'space-between' }}><small>00 hs</small><small>12 hs</small><small>23 hs</small></div>
            </section>
            <section style={card}><h2>Por día</h2><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
                <thead><tr><th>Fecha</th><th>Clientes atendidos</th><th>Mensajes entrantes</th><th>Chats nuevos observados</th><th>Tandas respondidas</th><th>Mediana</th></tr></thead>
                <tbody>{report.days.map((day) => <tr key={day.date}><td>{day.date}</td><td>{format(day.uniqueChats)}</td>
                    <td>{format(day.incomingMessages)}</td><td>{format(day.newIncomingChats)}</td><td>{format(day.response.answered)}</td>
                    <td>{day.response.medianMinutes == null ? '—' : `${day.response.medianMinutes} min`}</td></tr>)}</tbody>
            </table></div></section>
            {report.matching && <section style={card}><h2>Vínculos con clientes del ERP</h2>
                <p>{report.matching.linked} vinculados · {report.matching.ambiguous} ambiguos · {report.matching.withoutMatch} sin coincidencia · {report.matching.withoutPhone} sin teléfono recuperable.</p>
                <p>La vinculación automática exige una coincidencia única. Un chat de WhatsApp puede tener un ID sin número visible.</p>
                <ul>{report.matches.map((match) => <li key={match.clienteId}>
                    {match.nombreComercial} · {match.quality}</li>)}</ul>
            </section>}
        </>}
        {isAdmin && <section style={card}><h2>Conectar una computadora</h2>
            <p>Creá una credencial y pegala en Ajustes de la extensión. El código se muestra una sola vez.</p>
            <input aria-label="Nombre de la computadora" value={nombre} onChange={(event) => setNombre(event.target.value)}/>{' '}
            <button onClick={() => void createSource()}>Crear conexión</button>
            {token && <p>Credencial: <code style={{ userSelect: 'all' }}>{token}</code>{' '}
                <button onClick={() => void navigator.clipboard.writeText(token)}>Copiar</button></p>}
            <ul>{report?.sources.map((source) => <li key={source.id}>{source.nombre} · {source.activo ? 'activa' : 'revocada'}{' '}
                {source.activo && <button onClick={() => void revokeSource(source.id)}>Revocar</button>}</li>)}</ul>
        </section>}
    </div>
}
