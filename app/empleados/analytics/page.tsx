'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler,
} from 'chart.js'

import TabResumen from '@/components/analytics/TabResumen'
import TabInversion from '@/components/analytics/TabInversion'
import TabAsistencia from '@/components/analytics/TabAsistencia'
import TabPrestamos from '@/components/analytics/TabPrestamos'
import TabLegajo from '@/components/analytics/TabLegajo'
import type { AnalyticsData, AnalyticsTabId } from '@/components/analytics/analytics.types'
import { periodoAnalyticsValido, periodoMesActual, periodoSemanaActual } from '@/lib/analytics/fechas'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler)

const TABS: Array<{ id: AnalyticsTabId; label: string; descripcion: string }> = [
    { id: 'resumen', label: 'Resumen', descripcion: 'Indicadores generales' },
    { id: 'inversion', label: 'Inversión', descripcion: 'Nómina y costos' },
    { id: 'asistencia', label: 'Asistencia', descripcion: 'Puntualidad y ausencias' },
    { id: 'prestamos', label: 'Préstamos', descripcion: 'Saldos y recupero' },
    { id: 'legajo', label: 'Legajo', descripcion: 'Análisis individual' },
]

export default function RRHHAnalyticsPage() {
    const inicial = periodoMesActual()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<AnalyticsTabId>('resumen')
    const [filtroConcepto, setFiltroConcepto] = useState('todos')
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [fechaDesde, setFechaDesde] = useState(inicial.desde)
    const [fechaHasta, setFechaHasta] = useState(inicial.hasta)
    const [selectedEmpleado, setSelectedEmpleado] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        if (!periodoAnalyticsValido(fechaDesde, fechaHasta)) {
            setError('La fecha desde debe ser anterior o igual a la fecha hasta.')
            setLoading(false)
            return
        }

        const controller = new AbortController()
        const cargar = async () => {
            setLoading(true)
            setError(null)
            try {
                const params = new URLSearchParams({ desde: fechaDesde, hasta: fechaHasta })
                if (selectedEmpleado) params.set('empleadoId', selectedEmpleado)
                const response = await fetch(`/api/reportes/rrhh?${params}`, { signal: controller.signal })
                const json: AnalyticsData | { error?: string } = await response.json()
                if (!response.ok) throw new Error('error' in json && json.error ? json.error : 'No se pudieron cargar las analíticas.')
                setData(json as AnalyticsData)
            } catch (cause: unknown) {
                if (cause instanceof DOMException && cause.name === 'AbortError') return
                setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las analíticas.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }
        void cargar()
        return () => controller.abort()
    }, [fechaDesde, fechaHasta, selectedEmpleado, refreshKey])

    const seleccionarEmpleado = (id: string) => {
        setSelectedEmpleado(id)
        if (id) setActiveTab('legajo')
    }

    const aplicarPeriodo = (periodo: { desde: string; hasta: string }) => {
        setFechaDesde(periodo.desde)
        setFechaHasta(periodo.hasta)
    }

    if (loading && !data) return <div className="loading-container">Preparando analíticas…</div>
    if (error && !data) return <div className="error-state"><strong>No pudimos cargar Analíticas</strong><span>{error}</span><button className="btn btn-primary" onClick={() => setRefreshKey(key => key + 1)}>Reintentar</button></div>
    if (!data) return null

    return <main className="analytics-shell fade-in">
        <header className="analytics-header">
            <div>
                <span className="analytics-eyebrow">Recursos Humanos</span>
                <h1>Analíticas</h1>
                <p>Información consolidada para revisar dotación, costos y asistencia.</p>
            </div>
            <div className="analytics-status"><span className={loading ? 'status-dot loading' : 'status-dot'} />{loading ? 'Actualizando' : 'Datos actualizados'}</div>
        </header>

        <section className="analytics-filters" aria-label="Filtros de analíticas">
            <label><span>Empleado</span><select className="form-select" value={selectedEmpleado} onChange={event => seleccionarEmpleado(event.target.value)}><option value="">Todos los empleados</option>{data.empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre}</option>)}</select></label>
            <label><span>Desde</span><input type="date" className="form-input" value={fechaDesde} onChange={event => setFechaDesde(event.target.value)} /></label>
            <label><span>Hasta</span><input type="date" className="form-input" value={fechaHasta} onChange={event => setFechaHasta(event.target.value)} /></label>
            <div className="quick-periods"><button className="btn btn-outline" onClick={() => aplicarPeriodo(periodoSemanaActual())}>Esta semana</button><button className="btn btn-outline" onClick={() => aplicarPeriodo(periodoMesActual())}>Este mes</button><button className="btn btn-primary" disabled={loading} onClick={() => setRefreshKey(key => key + 1)}>Actualizar</button></div>
        </section>

        {error && <div className="analytics-warning">{error}</div>}

        <nav className="analytics-tabs" aria-label="Secciones de analíticas">
            {TABS.map(tab => {
                const disabled = tab.id === 'legajo' && !selectedEmpleado
                return <button key={tab.id} disabled={disabled} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><strong>{tab.label}</strong><span>{tab.descripcion}</span></button>
            })}
        </nav>

        <section className={loading ? 'analytics-content refreshing' : 'analytics-content'}>
            {activeTab === 'resumen' && <TabResumen data={data} />}
            {activeTab === 'inversion' && <TabInversion data={data} filtroConcepto={filtroConcepto} setFiltroConcepto={setFiltroConcepto} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
            {activeTab === 'asistencia' && <TabAsistencia data={data} setSelectedEmpleado={seleccionarEmpleado} setActiveTab={tab => setActiveTab(tab as AnalyticsTabId)} />}
            {activeTab === 'prestamos' && <TabPrestamos data={data} />}
            {activeTab === 'legajo' && <TabLegajo data={data} onRefresh={() => setRefreshKey(key => key + 1)} />}
        </section>

        <style jsx>{`
            .analytics-shell{min-height:100vh;background:var(--color-gray-50);padding:clamp(20px,3vw,40px);max-width:1600px;margin:0 auto}.analytics-header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:24px}.analytics-eyebrow{font-size:11px;font-weight:800;color:var(--color-primary);text-transform:uppercase;letter-spacing:.12em}.analytics-header h1{font-size:clamp(28px,4vw,40px);line-height:1;margin:7px 0 8px;letter-spacing:-.035em}.analytics-header p{color:var(--color-gray-500);margin:0}.analytics-status{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-gray-500);font-weight:600}.status-dot{width:8px;height:8px;border-radius:50%;background:var(--color-success)}.status-dot.loading{background:var(--color-warning)}.analytics-filters{display:grid;grid-template-columns:minmax(220px,1.4fr) minmax(145px,.7fr) minmax(145px,.7fr) auto;align-items:end;gap:16px;background:white;border:1px solid var(--color-gray-200);border-radius:var(--radius-lg);padding:18px;margin-bottom:20px;box-shadow:0 1px 2px rgba(15,23,42,.04)}.analytics-filters label{display:grid;gap:6px}.analytics-filters label>span{font-size:10px;font-weight:800;color:var(--color-gray-500);text-transform:uppercase;letter-spacing:.06em}.quick-periods{display:flex;gap:8px}.analytics-warning{padding:12px 16px;background:var(--color-danger-bg);color:var(--color-danger);border-radius:var(--radius-md);margin-bottom:16px;font-size:13px;font-weight:600}.analytics-tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:24px}.analytics-tabs button{display:grid;gap:3px;text-align:left;padding:13px 15px;background:white;border:1px solid var(--color-gray-200);border-radius:var(--radius-md);color:var(--color-gray-600);cursor:pointer;transition:150ms ease}.analytics-tabs button span{font-size:10px;color:var(--color-gray-400)}.analytics-tabs button:hover:not(:disabled){border-color:var(--color-primary);transform:translateY(-1px)}.analytics-tabs button.active{background:var(--color-primary);border-color:var(--color-primary);color:white;box-shadow:0 8px 18px rgba(59,130,246,.18)}.analytics-tabs button.active span{color:rgba(255,255,255,.72)}.analytics-tabs button:disabled{opacity:.45;cursor:not-allowed}.analytics-content{transition:opacity 150ms ease}.analytics-content.refreshing{opacity:.55;pointer-events:none}@media(max-width:980px){.analytics-filters{grid-template-columns:1fr 1fr}.analytics-tabs{grid-template-columns:repeat(3,1fr)}}@media(max-width:640px){.analytics-shell{padding:16px}.analytics-header{align-items:flex-start;flex-direction:column}.analytics-filters{grid-template-columns:1fr}.quick-periods{flex-wrap:wrap}.analytics-tabs{display:flex;overflow:auto}.analytics-tabs button{min-width:145px}}
        `}</style>
    </main>
}
