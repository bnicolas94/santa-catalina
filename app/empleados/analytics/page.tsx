'use client'

export const dynamic = 'force-dynamic'

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
    const [isClient, setIsClient] = useState(false)
    const [filtroConcepto, setFiltroConcepto] = useState<string>('todos')
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [fechaDesde, setFechaDesde] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d.toISOString().split('T')[0]
    })
    const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])
    const [expandedPrestamo, setExpandedPrestamo] = useState<string | null>(null)
    const [selectedEmpleado, setSelectedEmpleado] = useState<string>('')
    const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null)

    const togglePrestamo = (id: string) => {
        setExpandedPrestamo(expandedPrestamo === id ? null : id)
    }

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

    if (!isClient) return <div className="loading-container">Iniciando...</div>

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
            <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>📊 Analytics de Recursos Humanos</h1>
                    <p style={{ color: 'var(--color-gray-500)' }}>Indicadores clave de rendimiento y estructura del personal.</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', background: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-gray-200)', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                        <label className="form-label" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Empleado</label>
                        <select className="form-select" value={selectedEmpleado} onChange={e => { setSelectedEmpleado(e.target.value); setExpandedHistorico(null) }} style={{ padding: '4px 8px', height: 'auto' }}>
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

            {/* Vista Individual del Empleado */}
            {selectedEmpleado && data.historico ? (
                <div>
                    {/* KPIs Individuales */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Neto Acumulado</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-success)' }}>${data.historico.kpis.totalNeto.toLocaleString()}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.historico.kpis.cantidadLiquidaciones} liquidaciones</div>
                        </div>
                        <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Promedio Semanal</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>${data.historico.kpis.promedioNetoPorLiquidacion.toLocaleString()}</div>
                        </div>
                        <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Hs Extras Totales</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#f59e0b' }}>{data.historico.kpis.totalHsExtras}</div>
                        </div>
                        <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Ausentes</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: data.historico.kpis.totalDiasAusentes > 0 ? 'var(--color-danger)' : 'inherit' }}>{data.historico.kpis.totalDiasAusentes}</div>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.historico.kpis.totalDiasJustificados} justificados</div>
                        </div>
                        <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #8b5cf6' }}>
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Trabajados</div>
                            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{data.historico.kpis.totalDiasTrabajados}</div>
                        </div>
                        {data.historico.kpis.deudaPendiente > 0 && (
                            <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid var(--color-danger)' }}>
                                <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Préstamos</div>
                                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-danger)' }}>${data.historico.kpis.deudaPendiente.toLocaleString()}</div>
                            </div>
                        )}
                    </div>

                    {/* Tabla Historial de Liquidaciones */}
                    <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>📋 Historial de Liquidaciones — {data.historico.empleado?.nombre} {data.historico.empleado?.apellido || ''}</h3>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Periodo</th>
                                        <th style={{ textAlign: 'center' }}>Días Trab.</th>
                                        <th style={{ textAlign: 'center' }}>Ausencias</th>
                                        <th style={{ textAlign: 'center' }}>Justif.</th>
                                        <th style={{ textAlign: 'center' }}>Hs Extras</th>
                                        <th style={{ textAlign: 'right' }}>Base</th>
                                        <th style={{ textAlign: 'right' }}>Extras</th>
                                        <th style={{ textAlign: 'right' }}>Desc.</th>
                                        <th style={{ textAlign: 'right', fontWeight: 800 }}>Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.historico.semanas.length === 0 ? (
                                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>No hay liquidaciones registradas.</td></tr>
                                    ) : data.historico.semanas.map((s: any) => (
                                        <Fragment key={s.id}>
                                            <tr onClick={() => setExpandedHistorico(expandedHistorico === s.id ? null : s.id)} style={{ cursor: 'pointer', backgroundColor: expandedHistorico === s.id ? 'var(--color-info-bg)' : 'transparent' }}>
                                                <td>{expandedHistorico === s.id ? '▼' : '▶'}</td>
                                                <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{s.periodo}</td>
                                                <td style={{ textAlign: 'center' }}>{s.diasTrabajados}/{s.diasLaborales}</td>
                                                <td style={{ textAlign: 'center', color: s.diasAusentes > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>{s.diasAusentes}</td>
                                                <td style={{ textAlign: 'center', color: s.diasJustificados > 0 ? '#f59e0b' : 'inherit' }}>{s.diasJustificados}</td>
                                                <td style={{ textAlign: 'center', color: s.hsExtras > 0 ? 'var(--color-success)' : 'inherit' }}>{s.hsExtras}h</td>
                                                <td style={{ textAlign: 'right' }}>${s.sueldoBase.toLocaleString()}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>${s.montoExtras.toLocaleString()}</td>
                                                <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>-${s.descuentos.toLocaleString()}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>${s.neto.toLocaleString()}</td>
                                            </tr>
                                            {expandedHistorico === s.id && s.desglose?.length > 0 && (
                                                <tr>
                                                    <td colSpan={10} style={{ padding: 0, background: 'var(--color-gray-50)' }}>
                                                        <div style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                                                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-gray-500)', fontWeight: 800, marginBottom: 'var(--space-3)' }}>Desglose Día por Día</div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
                                                                {s.desglose.map((dia: any) => (
                                                                    <div key={dia.fecha} style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? '#f59e0b' : dia.horasTrabajadas > 0 ? 'var(--color-gray-200)' : dia.esJustificado ? '#10b981' : '#ef4444'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 || dia.esJustificado ? 1 : 0.6 }}>
                                                                        <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>{dia.diaSemana?.substring(0, 3)} {dia.fecha?.split('-')[2]}</span>
                                                                            {dia.esFeriado && <span>🚩</span>}
                                                                            {dia.esJustificado && <span style={{ color: '#10b981', fontSize: '9px' }}>✓M</span>}
                                                                        </div>
                                                                        <div>{dia.entrada || '--:--'} a {dia.salida || '--:--'}</div>
                                                                        <div style={{ color: 'var(--color-gray-500)' }}>HS: {dia.horasTrabajadas} {dia.horasExtras > 0 && <span style={{ color: 'var(--color-success)' }}>(+{dia.horasExtras})</span>}</div>
                                                                        <div style={{ fontWeight: 600, textAlign: 'right' }}>${dia.totalDia?.toLocaleString()}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
            <>
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
                                <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Inversión (Filtro)</span>
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
                                <th style={{ cursor: 'pointer' }} onClick={() => {
                                    const sorted = [...data.nomina.detalle].sort((a, b) => b.hsExtras - a.hsExtras)
                                    setData({ ...data, nomina: { ...data.nomina, detalle: sorted } })
                                }}>Hs Extras ↕</th>
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
                                }}>Neto ↕</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDetalle.map((l: any) => (
                                <Fragment key={l.id}>
                                    <tr>
                                        <td>
                                            <button 
                                                onClick={() => setExpandedRow(expandedRow === l.id ? null : l.id)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 'var(--space-1)' }}
                                            >
                                                {expandedRow === l.id ? '▼' : '▶'}
                                            </button>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{l.empleado}</td>
                                        <td>{l.hsExtras} hs</td>
                                        <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>${l.ingresos.toLocaleString()}</td>
                                        <td style={{ color: 'var(--color-danger)' }}>-${l.descuentos.toLocaleString()}</td>
                                        <td style={{ fontWeight: 700 }}>${l.neto.toLocaleString()}</td>
                                    </tr>
                                    {expandedRow === l.id && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '0', background: 'var(--color-gray-50)' }}>
                                                <div style={{ padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                                                    <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-gray-500)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Desglose de Conceptos</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                                                        {l.conceptos?.map((item: any, idx: number) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', background: 'white', borderRadius: '4px', border: '1px solid var(--color-gray-200)' }}>
                                                                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)' }}>{item.nombre}</span>
                                                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: item.tipo === 'DESCUENTO' ? 'var(--color-danger)' : 'inherit' }}>
                                                                    {item.tipo === 'DESCUENTO' ? '-' : ''}${item.monto.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detalle de Tardanzas */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>🕒 Detalle de Tardanzas en el Periodo</h3>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Fecha</th>
                                <th style={{ textAlign: 'center' }}>Entrada Esperada</th>
                                <th style={{ textAlign: 'center' }}>Fichada</th>
                                <th style={{ textAlign: 'center' }}>Retraso</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.asistencia.detalleTardanzas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay tardanzas registradas en este periodo.
                                    </td>
                                </tr>
                            ) : (
                                data.asistencia.detalleTardanzas.map((t: any, idx: number) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600 }}>{t.empleadoNombre}</td>
                                        <td>{new Date(t.fecha).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'center' }}>{t.horaEsperada} hs</td>
                                        <td style={{ textAlign: 'center', color: 'var(--color-danger)', fontWeight: 600 }}>{t.horaFichada} hs</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-danger" style={{ fontSize: '11px' }}>
                                                {t.minutosRetraso} min
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => setSelectedEmpleado(t.empleadoId)}>
                                                Ir al Legajo
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
                {/* Gráficos / Distribución */}
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Distribución por Área</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={areaChartData} options={{ maintainAspectRatio: false }} />
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Distribución por Puesto</h3>
                    <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
                        <Pie data={puestoChartData} options={{ maintainAspectRatio: false }} />
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
            </>
            )}

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
