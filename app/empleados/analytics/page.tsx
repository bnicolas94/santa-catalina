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
import styles from '@/components/analytics/analytics.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler)

const TABS: Array<{ id: AnalyticsTabId; label: string; descripcion: string; icono: string }> = [
    { id: 'resumen', label: 'Resumen', descripcion: 'Vista ejecutiva', icono: '01' },
    { id: 'inversion', label: 'Inversión', descripcion: 'Nómina y costos', icono: '02' },
    { id: 'asistencia', label: 'Asistencia', descripcion: 'Hábitos y alertas', icono: '03' },
    { id: 'prestamos', label: 'Préstamos', descripcion: 'Saldos y recupero', icono: '04' },
    { id: 'legajo', label: 'Legajo', descripcion: 'Análisis individual', icono: '05' },
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

    return <main className={`${styles.shell} fade-in`}>
        <header className={styles.header}>
            <div className={styles.headerCopy}>
                <span className={styles.eyebrow}>Recursos Humanos · Centro de control</span>
                <h1>Analíticas</h1>
                <p>Una lectura ordenada de dotación, inversión y asistencia.</p>
            </div>
            <div className={styles.headerMeta}>
                <span className={styles.periodLabel}>{fechaDesde.split('-').reverse().join('/')} — {fechaHasta.split('-').reverse().join('/')}</span>
                <div className={styles.status}><span className={`${styles.statusDot} ${loading ? styles.statusLoading : ''}`} />{loading ? 'Actualizando datos' : 'Información actualizada'}</div>
            </div>
        </header>

        <section className={styles.filters} aria-label="Filtros de analíticas">
            <div className={styles.filterGroup}>
                <label className={styles.employeeFilter}><span>Alcance</span><select className="form-select" value={selectedEmpleado} onChange={event => seleccionarEmpleado(event.target.value)}><option value="">Toda la dotación</option>{data.empleados.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre}</option>)}</select></label>
                <div className={styles.dateRange}>
                    <label><span>Desde</span><input type="date" className="form-input" value={fechaDesde} onChange={event => setFechaDesde(event.target.value)} /></label>
                    <span className={styles.rangeArrow}>→</span>
                    <label><span>Hasta</span><input type="date" className="form-input" value={fechaHasta} onChange={event => setFechaHasta(event.target.value)} /></label>
                </div>
            </div>
            <div className={styles.quickPeriods}><button className="btn btn-outline" onClick={() => aplicarPeriodo(periodoSemanaActual())}>Semana</button><button className="btn btn-outline" onClick={() => aplicarPeriodo(periodoMesActual())}>Mes</button><button className="btn btn-primary" disabled={loading} onClick={() => setRefreshKey(key => key + 1)}>{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
        </section>

        {error && <div className={styles.warning}>{error}</div>}

        <nav className={styles.tabs} aria-label="Secciones de analíticas">
            {TABS.map(tab => {
                const disabled = tab.id === 'legajo' && !selectedEmpleado
                return <button key={tab.id} disabled={disabled} className={activeTab === tab.id ? styles.activeTab : ''} onClick={() => setActiveTab(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined} title={disabled ? 'Seleccioná un empleado para abrir su legajo' : undefined}><span className={styles.tabIndex}>{tab.icono}</span><span className={styles.tabCopy}><strong>{tab.label}</strong><small>{tab.descripcion}</small></span></button>
            })}
        </nav>

        <section className={`${styles.content} ${loading ? styles.refreshing : ''}`}>
            {activeTab === 'resumen' && <TabResumen data={data} />}
            {activeTab === 'inversion' && <TabInversion data={data} filtroConcepto={filtroConcepto} setFiltroConcepto={setFiltroConcepto} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />}
            {activeTab === 'asistencia' && <TabAsistencia data={data} setSelectedEmpleado={seleccionarEmpleado} setActiveTab={tab => setActiveTab(tab as AnalyticsTabId)} />}
            {activeTab === 'prestamos' && <TabPrestamos data={data} />}
            {activeTab === 'legajo' && <TabLegajo data={data} onRefresh={() => setRefreshKey(key => key + 1)} />}
        </section>
    </main>
}
