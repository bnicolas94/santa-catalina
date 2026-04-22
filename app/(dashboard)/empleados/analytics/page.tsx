'use client'

import { useState, useEffect } from 'react'
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler
} from 'chart.js'
import { Bar, Pie } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, ArcElement, Filler
)

export default function RRHHAnalyticsPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/reportes/rrhh?desde=${fechaDesde}&hasta=${fechaHasta}`)
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
        fetchData()
    }, [fechaDesde, fechaHasta])

    if (loading && !data) return <div className="loading-container">Cargando Analytics...</div>
    if (error) return <div className="error-state">{error}</div>
    if (!data) return null

    // Chart Data: Distribución por Área
    const areaChartData = {
        labels: data.distribucion.area.map((a: any) => a.nombre),
        datasets: [{
            label: 'Empleados por Área',
            data: data.distribucion.area.map((a: any) => a.cantidad),
            backgroundColor: [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
            ],
            borderWidth: 1
        }]
    }

    // Chart Data: Distribución por Puesto
    const puestoChartData = {
        labels: data.distribucion.puesto.map((p: any) => p.nombre),
        datasets: [{
            label: 'Empleados por Puesto',
            data: data.distribucion.puesto.map((p: any) => p.cantidad),
            backgroundColor: [
                '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'
            ],
            borderWidth: 1
        }]
    }

    // Chart Data: Masa Salarial por Área
    const payrollChartData = {
        labels: data.nomina.porArea.map((a: any) => a.nombre),
        datasets: [{
            label: 'Inversión Salarial ($)',
            data: data.nomina.porArea.map((a: any) => a.monto),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1
        }]
    }

    return (
        <div className="analytics-container fade-in" style={{ padding: 'var(--space-6)' }}>
            <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>📊 Analytics de Recursos Humanos</h1>
                    <p style={{ color: 'var(--color-gray-500)' }}>Indicadores clave de rendimiento y estructura del personal.</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', background: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-gray-200)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Desde</label>
                        <input type="date" className="form-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ padding: '4px 8px', height: 'auto' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Hasta</label>
                        <input type="date" className="form-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ padding: '4px 8px', height: 'auto' }} />
                    </div>
                    <button className="btn btn-outline" onClick={fetchData} style={{ marginTop: '14px' }}>🔄</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Empleados Activos</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>{data.stats.activos}</div>
                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', color: 'var(--color-gray-400)' }}>Total Legajos: {data.stats.total}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Tardanzas</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeTardanzas > 15 ? 'var(--color-danger)' : 'inherit' }}>
                        {data.asistencia.porcentajeTardanzas.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', color: 'var(--color-gray-400)' }}>{data.asistencia.tardanzas} fichadas con retraso</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Ausentismo</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.asistencia.porcentajeAusentismo > 10 ? 'var(--color-danger)' : 'inherit' }}>
                        {data.asistencia.porcentajeAusentismo.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', color: 'var(--color-gray-400)' }}>{data.asistencia.ausencias} ausencias registradas</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Masa Salarial Netas</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>
                        ${data.nomina.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', color: 'var(--color-gray-400)' }}>En el periodo seleccionado</div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>Distribución por Área</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={areaChartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>Distribución por Puesto</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={puestoChartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)', gridColumn: 'span 2' }}>
                    <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>Masa Salarial por Área (Inversión neta)</h3>
                    <div style={{ height: '300px' }}>
                        <Bar 
                            data={payrollChartData} 
                            options={{ 
                                maintainAspectRatio: false,
                                scales: { y: { beginAtZero: true } }
                            }} 
                        />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .analytics-container {
                    background-color: var(--color-gray-50);
                    min-height: 100vh;
                }
                .card {
                    background: white;
                    border-radius: var(--radius-xl);
                    border: 1px solid var(--color-gray-200);
                }
            `}</style>
        </div>
    )
}
