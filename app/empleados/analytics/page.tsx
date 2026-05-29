'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js'

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler
)

import TabResumen from '@/components/analytics/TabResumen'
import TabInversion from '@/components/analytics/TabInversion'
import TabAsistencia from '@/components/analytics/TabAsistencia'
import TabPrestamos from '@/components/analytics/TabPrestamos'
import TabLegajo from '@/components/analytics/TabLegajo'

const TABS = [
    { id: 'resumen', label: '📊 Resumen', icon: '📊' },
    { id: 'inversion', label: '💰 Inversión y Costos', icon: '💰' },
    { id: 'asistencia', label: '📋 Asistencia', icon: '📋' },
    { id: 'prestamos', label: '🏦 Préstamos', icon: '🏦' },
    { id: 'legajo', label: '👤 Legajo Individual', icon: '👤' },
]

export default function RRHHAnalyticsPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isClient, setIsClient] = useState(false)
    const [activeTab, setActiveTab] = useState('resumen')
    const [filtroConcepto, setFiltroConcepto] = useState<string>('todos')
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
    const [selectedEmpleado, setSelectedEmpleado] = useState<string>('')

    const fetchData = async () => {
        setLoading(true)
        try {
            let url = `/api/reportes/rrhh?desde=${fechaDesde}&hasta=${fechaHasta}`
            if (selectedEmpleado) url += `&empleadoId=${selectedEmpleado}`
            const res = await fetch(url)
            if (!res.ok) throw new Error('Error al cargar reportes')
            const json = await res.json()
            setData(json)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setIsClient(true)
        fetchData()
    }, [fechaDesde, fechaHasta, selectedEmpleado])

    // Auto-switch to legajo tab when employee is selected
    const handleSelectEmpleado = (id: string) => {
        setSelectedEmpleado(id)
        if (id) setActiveTab('legajo')
    }

    if (!isClient) return <div className="loading-container">Iniciando...</div>
    if (loading && !data) return <div className="loading-container">Cargando Analytics...</div>
    if (error) return <div className="error-state">{error}</div>
    if (!data) return null

    return (
        <div className="analytics-container fade-in" style={{ padding: 'var(--space-6)' }}>
            {/* Header con filtros */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>📊 Analytics de Recursos Humanos</h1>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Indicadores clave de rendimiento y estructura del personal.</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', background: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-gray-200)', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Empleado</label>
                        <select className="form-select" value={selectedEmpleado} onChange={e => handleSelectEmpleado(e.target.value)} style={{ padding: '4px 8px', height: 'auto' }}>
                            <option value="">👥 Todos (Vista Global)</option>
                            {data?.empleados?.map((e: any) => (
                                <option key={e.id} value={e.id}>{e.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Desde</label>
                        <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ padding: '4px 8px', height: 'auto' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Hasta</label>
                        <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ padding: '4px 8px', height: 'auto' }} />
                    </div>
                    <button 
                        className="btn btn-outline" 
                        onClick={() => {
                            const now = new Date()
                            const first = now.getDate() - now.getDay() + 1
                            const monday = new Date(now.setDate(first))
                            const sunday = new Date(now.setDate(first + 6))
                            setFechaDesde(monday.toISOString().split('T')[0])
                            setFechaHasta(sunday.toISOString().split('T')[0])
                        }}
                        style={{ fontSize: '10px' }}
                    >
                        📅 Esta Semana
                    </button>
                    <button 
                        className="btn btn-outline" 
                        onClick={() => {
                            const now = new Date()
                            const first = new Date(now.getFullYear(), now.getMonth(), 1)
                            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                            setFechaDesde(first.toISOString().split('T')[0])
                            setFechaHasta(last.toISOString().split('T')[0])
                        }}
                        style={{ fontSize: '10px' }}
                    >
                        🗓️ Este Mes
                    </button>
                    <button className="btn btn-outline" onClick={fetchData} style={{ marginTop: '14px' }}>🔄</button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ 
                display: 'flex', 
                gap: '0', 
                borderBottom: '2px solid var(--color-gray-200)', 
                marginBottom: 'var(--space-6)',
                overflowX: 'auto',
                background: 'white',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                padding: '0 var(--space-2)'
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            if (tab.id === 'legajo' && !selectedEmpleado) return
                            setActiveTab(tab.id)
                        }}
                        style={{
                            padding: 'var(--space-3) var(--space-5)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--color-primary)' : tab.id === 'legajo' && !selectedEmpleado ? 'var(--color-gray-300)' : 'var(--color-gray-500)',
                            background: 'none',
                            border: 'none',
                            borderBottomWidth: '2px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: activeTab === tab.id ? 'var(--color-primary)' : 'transparent',
                            cursor: tab.id === 'legajo' && !selectedEmpleado ? 'not-allowed' : 'pointer',
                            transition: 'all 150ms ease',
                            whiteSpace: 'nowrap',
                            marginBottom: '-2px',
                            opacity: tab.id === 'legajo' && !selectedEmpleado ? 0.5 : 1
                        }}
                    >
                        {tab.label}
                        {tab.id === 'legajo' && selectedEmpleado && (
                            <span style={{ 
                                marginLeft: 'var(--space-2)', 
                                background: 'var(--color-primary-light)', 
                                color: 'var(--color-primary)',
                                padding: '1px 6px', 
                                borderRadius: 'var(--radius-full)', 
                                fontSize: '10px' 
                            }}>
                                ●
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Loading overlay for tab content */}
            {loading && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--space-4)', 
                    color: 'var(--color-gray-400)', 
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--space-4)'
                }}>
                    Actualizando datos...
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'resumen' && <TabResumen data={data} />}
            {activeTab === 'inversion' && (
                <TabInversion 
                    data={data} 
                    filtroConcepto={filtroConcepto}
                    setFiltroConcepto={setFiltroConcepto}
                    expandedRow={expandedRow}
                    setExpandedRow={setExpandedRow}
                />
            )}
            {activeTab === 'asistencia' && (
                <TabAsistencia 
                    data={data} 
                    setSelectedEmpleado={handleSelectEmpleado}
                    setActiveTab={setActiveTab}
                />
            )}
            {activeTab === 'prestamos' && <TabPrestamos data={data} />}
            {activeTab === 'legajo' && <TabLegajo data={data} onRefresh={fetchData} />}

            <style jsx>{`
                .analytics-container {
                    background-color: var(--color-gray-50);
                    min-height: 100vh;
                    padding: var(--space-8);
                }
            `}</style>
        </div>
    )
}
