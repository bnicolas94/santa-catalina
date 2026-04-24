'use client'

import { useState, useEffect, Fragment } from 'react'
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
    const [filtroConcepto, setFiltroConcepto] = useState<string>('todos')
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
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

    const filteredDetalle = data.nomina.detalle.filter((liq: any) => {
        if (filtroConcepto === 'todos') return true
        return liq.conceptos.some((c: any) => c.nombre === filtroConcepto)
    })

    // KPI Cards calculation for filtered view (optional, but good for UX)
    const filteredTotalHsExtras = filteredDetalle.reduce((acc: number, l: any) => acc + l.hsExtras, 0)
    const filteredInversionExtras = filteredDetalle.reduce((acc: number, l: any) => acc + l.montoExtras, 0)

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
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Inversión Periodo</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>
                        ${data.nomina.total.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)', color: 'var(--color-gray-400)' }}>Masa salarial neta</div>
                </div>
            </div>

            {/* Planilla de Liquidaciones */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>📋 Planilla de Liquidaciones</h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>Detalle de pagos y desglose de conceptos.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Filtrar por Concepto</label>
                            <select 
                                className="form-select" 
                                value={filtroConcepto} 
                                onChange={e => setFiltroConcepto(e.target.value)}
                                style={{ height: '36px', padding: '4px 12px' }}
                            >
                                <option value="todos">Mostrar todos los conceptos</option>
                                {data.nomina.conceptos.map((c: string) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <div className="card shadow-sm" style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '3px solid var(--color-primary)', display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Hs Extras (Filtro)</span>
                                <span style={{ fontWeight: 700 }}>{filteredTotalHsExtras.toFixed(1)} hs</span>
                            </div>
                            <div className="card shadow-sm" style={{ padding: 'var(--space-2) var(--space-4)', borderLeft: '3px solid var(--color-success)', display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Gráficos / Distribución */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Distribución por Área</h3>
                        {data.distribucion.area.map((a: any) => (
                            <div key={a.nombre} style={{ marginBottom: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                                    <span>{a.nombre}</span>
                                    <span style={{ fontWeight: 700 }}>{a.cantidad}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--color-gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(a.cantidad / data.stats.total) * 100}%`, height: '100%', background: 'var(--color-primary)' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Inversión por Área</h3>
                        {data.nomina.porArea.map((a: any) => (
                            <div key={a.nombre} style={{ marginBottom: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                                    <span>{a.nombre}</span>
                                    <span style={{ fontWeight: 700 }}>${a.monto.toLocaleString()}</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--color-gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(a.monto / data.nomina.total) * 100}%`, height: '100%', background: 'var(--color-success)' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sección de Préstamos */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>💰 Préstamos y Adelantos Activos</h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>Saldos pendientes de cobro consolidado por empleado.</p>
                    </div>
                    <div className="card shadow-sm" style={{ padding: 'var(--space-3) var(--space-6)', borderLeft: '4px solid var(--color-danger)', background: 'var(--color-gray-50)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Total a Recuperar</div>
                        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-danger)' }}>
                            ${data.prestamos.totalDeuda.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.prestamos.detalle].sort((a, b) => a.empleado.localeCompare(b.empleado))
                                    setData({ ...data, prestamos: { ...data.prestamos, detalle: sorted } })
                                }}>Empleado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.prestamos.detalle].sort((a, b) => b.montoTotal - a.montoTotal)
                                    setData({ ...data, prestamos: { ...data.prestamos, detalle: sorted } })
                                }}>Monto Otorgado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.prestamos.detalle].sort((a, b) => b.pagado - a.pagado)
                                    setData({ ...data, prestamos: { ...data.prestamos, detalle: sorted } })
                                }}>Monto Recuperado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.prestamos.detalle].sort((a, b) => b.saldo - a.saldo)
                                    setData({ ...data, prestamos: { ...data.prestamos, detalle: sorted } })
                                }}>Saldo Pendiente ↕</th>
                                <th>Cuotas</th>
                                <th style={{ width: '200px' }}>Progreso</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.prestamos.detalle.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay préstamos activos en este momento.
                                    </td>
                                </tr>
                            ) : (
                                data.prestamos.detalle.map((p: any) => (
                                    <Fragment key={p.id}>
                                        <tr>
                                            <td>
                                                {p.prestamosActivos > 1 && (
                                                    <button 
                                                        onClick={() => togglePrestamo(p.id)}
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 'var(--space-1)' }}
                                                    >
                                                        {expandedPrestamo === p.id ? '▼' : '▶'}
                                                    </button>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{p.empleado}</td>
                                            <td>${p.montoTotal.toLocaleString()}</td>
                                            <td style={{ color: 'var(--color-success)' }}>${p.pagado.toLocaleString()}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-danger)' }}>${p.saldo.toLocaleString()}</td>
                                            <td>{p.cuotas}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <div style={{ flex: 1, height: '6px', background: 'var(--color-gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${p.progreso}%`, height: '100%', background: 'var(--color-primary)' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '10px', fontWeight: 600 }}>{p.progreso.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedPrestamo === p.id && (
                                            <tr>
                                                <td colSpan={7} style={{ padding: '0', background: 'var(--color-gray-50)' }}>
                                                    <div style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-danger)' }}>
                                                        <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-gray-500)', fontWeight: 800, marginBottom: 'var(--space-4)' }}>Detalle de Préstamos Individuales</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                            {p.listaPrestamos.map((item: any) => (
                                                                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 'var(--space-4)', padding: 'var(--space-3)', background: 'white', borderRadius: '8px', border: '1px solid var(--color-gray-200)', alignItems: 'center' }}>
                                                                    <div>
                                                                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{item.observaciones || 'Préstamo Personal'}</div>
                                                                        <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Otorgado el {new Date(item.fecha).toLocaleDateString()}</div>
                                                                    </div>
                                                                    <div style={{ fontSize: 'var(--text-sm)' }}>${item.montoTotal.toLocaleString()}</div>
                                                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>${item.pagado.toLocaleString()}</div>
                                                                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)' }}>${item.saldo.toLocaleString()}</div>
                                                                    <div style={{ fontSize: 'var(--text-sm)' }}>{item.cuotas} cuotas</div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <div style={{ flex: 1, height: '4px', background: 'var(--color-gray-100)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                            <div style={{ width: `${item.progreso}%`, height: '100%', background: 'var(--color-danger)' }}></div>
                                                                        </div>
                                                                        <span style={{ fontSize: '10px' }}>{item.progreso.toFixed(0)}%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx>{`
                .analytics-container {
                    background-color: var(--color-gray-50);
                    min-height: 100vh;
                    padding: var(--space-8);
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
