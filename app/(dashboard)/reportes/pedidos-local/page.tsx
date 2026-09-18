'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import type { ReportePedidosLocal } from '@/lib/reportes/pedidos-local'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const moneda = (valor: number | null) => valor === null ? 'Sin datos' : valor.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const hora = (valor: number) => `${String(valor).padStart(2, '0')}:00`
const fechaArgentina = (fecha: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)

export default function PedidosLocalPage() {
    const [desde, setDesde] = useState(() => fechaArgentina(new Date(Date.now() - 6 * 86_400_000)))
    const [hasta, setHasta] = useState(() => fechaArgentina(new Date()))
    const [hoja, setHoja] = useState('Pedidos_comunes')
    const [ubicacion, setUbicacion] = useState('')
    const [estado, setEstado] = useState('entregado')
    const [revision, setRevision] = useState(0)
    const [resultado, setResultado] = useState<{ clave: string; data: ReportePedidosLocal | null; error: string } | null>(null)
    const [opciones, setOpciones] = useState({ hojas: ['Pedidos_comunes', 'Pedidos_online'], ubicaciones: [] as string[] })
    const consulta = new URLSearchParams({ desde, hasta, hoja, ubicacion, estado }).toString()
    const clave = `${consulta}&revision=${revision}`
    const loading = resultado?.clave !== clave
    const data = resultado?.data
    const error = resultado?.error

    useEffect(() => {
        const controller = new AbortController()
        fetch(`/api/reportes/pedidos-local?${consulta}`, { signal: controller.signal })
            .then(async res => {
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'No se pudo cargar el reporte.')
                return json as ReportePedidosLocal
            })
            .then(json => {
                if (controller.signal.aborted) return
                setResultado({ clave, data: json, error: '' })
                setOpciones({ hojas: json.hojas, ubicaciones: json.ubicaciones })
            })
            .catch(err => { if (!controller.signal.aborted) setResultado({ clave, data: null, error: err instanceof Error ? err.message : 'No se pudo cargar el reporte.' }) })
        return () => controller.abort()
    }, [consulta, clave])

    return <div className="fade-in">
        <Link href="/reportes" className="btn btn-ghost btn-sm">← Reportes</Link>
        <h1 style={{ marginTop: 16 }}>Pedidos de local</h1>
        <p style={{ color: 'var(--color-gray-600)' }}>Tickets por hora de registro del pedido, en horario argentino. Cada ID cuenta una vez por hoja.</p>
        <div className="card" style={{ padding: 20, margin: '20px 0', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end' }}>
            <label>Desde<input className="form-input" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
            <label>Hasta<input className="form-input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
            <label>Origen<select className="form-select" value={hoja} onChange={e => { setHoja(e.target.value); setUbicacion('') }}>
                <option value="">Todas las hojas</option>
                {opciones.hojas.map(h => <option key={h} value={h}>{h === 'Pedidos_comunes' ? 'Pedidos comunes' : h === 'Pedidos_online' ? 'Pedidos online' : h}</option>)}
            </select></label>
            <label>Ubicación del Sheet<select className="form-select" value={ubicacion} onChange={e => setUbicacion(e.target.value)}>
                <option value="">Todas las ubicaciones</option>
                {opciones.ubicaciones.map(u => <option key={u}>{u}</option>)}
            </select></label>
            <label>Estado<select className="form-select" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="entregado">Sólo entregados</option><option value="todos">Todos los estados</option>
            </select></label>
            <button className="btn btn-secondary" disabled={loading} onClick={() => setRevision(v => v + 1)}>Actualizar</button>
        </div>
        {loading ? <p role="status">Leyendo pedidos…</p> : error ? <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p> : data && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
                {[
                    ['Tickets', data.tickets.toLocaleString('es-AR')],
                    ['Importe de pedidos', data.ticketsConImporte ? moneda(data.importe) : 'Sin datos'],
                    ['Ticket promedio', moneda(data.ticketPromedio)],
                    ['Hora pico', data.horasPico.length ? data.horasPico.map(hora).join(', ') : 'Sin datos'],
                ].map(([titulo, valor]) => <div key={titulo} className="card" style={{ padding: 20 }}><div style={{ color: 'var(--color-gray-600)' }}>{titulo}</div><strong style={{ display: 'block', marginTop: 8, fontSize: 26 }}>{valor}</strong></div>)}
            </div>
            <div className="card" style={{ padding: 20, marginTop: 20 }}>
                <h2 style={{ fontSize: 18 }}>Tickets por hora</h2>
                <p style={{ color: 'var(--color-gray-600)', fontSize: 13 }}>Total acumulado del período · {data.diasConTickets} días con tickets de {data.diasPeriodo} días seleccionados.</p>
                {data.tickets ? <div style={{ height: 300 }}><Bar
                    aria-label="Cantidad de tickets por hora de registro" role="img"
                    data={{ labels: data.porHora.map(h => hora(h.hora)), datasets: [{ label: 'Tickets', data: data.porHora.map(h => h.tickets), backgroundColor: data.porHora.map(h => data.horasPico.includes(h.hora) ? '#047857' : '#60a5fa'), borderRadius: 4 }] }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }}
                /></div> : <p>No hay tickets para estos filtros. Probá otro período, ubicación o estado.</p>}
                <details style={{ marginTop: 20 }}>
                    <summary style={{ cursor: 'pointer' }}>Ver detalle de las 24 horas</summary>
                    <div style={{ overflowX: 'auto', marginTop: 12 }}><table className="table" style={{ width: '100%' }}>
                        <thead><tr><th>Hora</th><th>Tickets</th><th>% del total</th><th>Importe</th><th>Ticket promedio</th></tr></thead>
                        <tbody>{data.porHora.map(h => <tr key={h.hora}><td>{hora(h.hora)}</td><td>{h.tickets}</td><td>{h.porcentaje.toFixed(1)}%</td><td>{h.tickets && h.ticketPromedio === null ? 'Sin datos' : moneda(h.importe)}</td><td>{moneda(h.ticketPromedio)}</td></tr>)}</tbody>
                    </table></div>
                </details>
            </div>
            <p style={{ color: 'var(--color-gray-600)', fontSize: 13, marginTop: 16 }}>
                Lectura del Sheet: {new Date(data.actualizado).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}. Se reutiliza hasta 2 minutos.
                {' '}Datos disponibles para el origen y ubicación: {data.cobertura.desde ?? 'sin fecha'} a {data.cobertura.hasta ?? 'sin fecha'} ({data.cobertura.diasDisponibles} días con registros).
                {' '}El Sheet puede tener días incompletos; los días sin registros no prueban ausencia de ventas. Esta hora no identifica el momento de cobro o entrega.
            </p>
            {estado === 'todos' && <p>Incluye cualquier estado del Sheet, incluso pendientes o cancelados. El importe representa pedidos, no ventas confirmadas.</p>}
            {(data.calidad.sinFechaHora > 0 || data.calidad.idsEnConflicto > 0 || data.calidad.duplicados > 0 || data.calidad.sinImporte > 0) && <details>
                <summary style={{ cursor: 'pointer' }}>Calidad de los datos</summary>
                <p>En el origen y ubicación seleccionados: {data.calidad.sinFechaHora} IDs sin fecha y hora válidas y {data.calidad.idsEnConflicto} IDs con datos contradictorios excluidos; {data.calidad.duplicados} filas duplicadas contadas una sola vez.</p>
                <p>En el período y estado seleccionados: {data.calidad.sinImporte} tickets sin importe positivo válido. Cuentan como tickets, pero se excluyen del importe y del promedio.</p>
            </details>}
        </>}
    </div>
}
