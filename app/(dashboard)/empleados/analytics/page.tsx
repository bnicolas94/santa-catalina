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
                                <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Extras (Filtro)</span>
                                <span style={{ fontWeight: 700 }}>${filteredInversionExtras.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => a.empleado.localeCompare(b.empleado))
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Empleado ↕</th>
                                <th>Periodo</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.hsExtras - a.hsExtras)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Hs Extras ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.montoExtras - a.montoExtras)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Monto Extras ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.ingresos - a.ingresos)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Ingresos ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.descuentos - a.descuentos)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Descuentos ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.neto - a.neto)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Neto Final ↕</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDetalle.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay liquidaciones con el concepto seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                filteredDetalle.map((liq: any) => (
                                    <Fragment key={liq.id}>
                                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === liq.id ? null : liq.id)}>
                                            <td style={{ fontSize: '12px', color: 'var(--color-gray-400)' }}>{expandedRow === liq.id ? '▼' : '▶'}</td>
                                            <td style={{ fontWeight: 600 }}>{liq.empleado}</td>
                                            <td style={{ fontSize: 'var(--text-xs)' }}>{liq.periodo}</td>
                                            <td style={{ color: liq.hsExtras > 0 ? 'var(--color-primary)' : 'inherit', fontWeight: liq.hsExtras > 0 ? 700 : 400 }}>
                                                {liq.hsExtras} hs
                                            </td>
                                            <td>${liq.montoExtras.toLocaleString()}</td>
                                            <td>${liq.ingresos.toLocaleString()}</td>
                                            <td style={{ color: 'var(--color-danger)' }}>{liq.descuentos > 0 ? `-$${liq.descuentos.toLocaleString()}` : '-'}</td>
                                            <td style={{ fontWeight: 800, color: 'var(--color-success)' }}>${liq.neto.toLocaleString()}</td>
                                        </tr>
                                        {expandedRow === liq.id && (
                                            <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                                <td colSpan={8} style={{ padding: 'var(--space-4) var(--space-8)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-2)' }}>
                                                        {liq.conceptos?.map((c: any, idx: number) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', borderBottom: '1px solid var(--color-gray-200)', background: 'white', borderRadius: '4px' }}>
                                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>{c.nombre}</span>
                                                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: c.tipo === 'DESCUENTO' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                                                    {c.tipo === 'DESCUENTO' ? '-' : ''}${c.monto.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {(!liq.conceptos || liq.conceptos.length === 0) && (
                                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)' }}>No hay conceptos detallados para esta liquidación.</div>
                                                        )}
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

            {/* Charts Grid */}
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
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

            {/* Sección de Préstamos */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>💰 Préstamos y Adelantos Activos</h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>Saldos pendientes de cobro por empleado.</p>
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
                                <th>Empleado</th>
                                <th>Monto Otorgado</th>
                                <th>Monto Recuperado</th>
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
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay préstamos activos en este momento.
                                    </td>
                                </tr>
                            ) : (
                                data.prestamos.detalle.map((p: any) => (
                                    <tr key={p.id}>
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
