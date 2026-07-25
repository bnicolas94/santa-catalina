'use client'

import { Fragment } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import type { AnalyticsData } from './analytics.types'

interface TabInversionProps {
    data: AnalyticsData
    filtroConcepto: string
    setFiltroConcepto: (v: string) => void
    expandedRow: string | null
    setExpandedRow: (v: string | null) => void
}

export default function TabInversion({ data, filtroConcepto, setFiltroConcepto, expandedRow, setExpandedRow }: TabInversionProps) {
    const filteredDetalle = data.nomina.detalle.filter(liq => {
        if (filtroConcepto === 'todos') return true
        return liq.conceptos.some(c => c.nombre === filtroConcepto)
    })

    // Tendencia semanal chart
    const tendencia = data.inversion?.tendenciaSemanal || []
    const tendenciaChartData = {
        labels: tendencia.map(t => t.periodo),
        datasets: [
            {
                label: 'Inversión Total',
                data: tendencia.map(t => t.totalNeto),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
                borderWidth: 2
            },
            {
                label: 'Horas Extras',
                data: tendencia.map(t => t.montoExtras),
                borderColor: '#8b5cf6',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                borderDash: [5, 5]
            },
            {
                label: 'Feriados',
                data: tendencia.map(t => t.montoFeriados),
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                borderDash: [3, 3]
            }
        ]
    }

    // Top extras employees
    const topExtrasEmployees = [...(data.nomina?.detalle || [])]
        .filter(l => l.hsExtras > 0)
        .sort((a, b) => b.montoExtras - a.montoExtras)
        .slice(0, 8)

    const extrasChartData = {
        labels: topExtrasEmployees.map(l => l.empleado),
        datasets: [{
            label: 'Costo Horas Extras ($)',
            data: topExtrasEmployees.map(l => l.montoExtras),
            backgroundColor: 'rgba(139, 92, 246, 0.5)',
            borderColor: '#8b5cf6',
            borderWidth: 1
        }]
    }

    // Payroll by area
    const payrollChartData = {
        labels: data.nomina.porArea.map(a => a.nombre),
        datasets: [{
            label: 'Inversión Salarial ($)',
            data: data.nomina.porArea.map(a => a.monto),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1
        }]
    }

    const barOptions = {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: (value: string | number) => '$' + value.toLocaleString() } } }
    }

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Ratio Extras / Base</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.inversion.ratioExtrasBase > 25 ? 'var(--color-danger)' : data.inversion.ratioExtrasBase > 15 ? '#f59e0b' : 'inherit' }}>
                        {data.inversion.ratioExtrasBase}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>
                        {data.inversion.ratioExtrasBase > 25 ? '⚠️ Elevado - evaluar contratación' : data.inversion.ratioExtrasBase > 15 ? '⚡ Moderado' : '✅ Saludable'}
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Costo por Hora Efectiva</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>${data.inversion.costoHoraEfectiva.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Inversión total / hs trabajadas</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Costo Feriados</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: '#f59e0b' }}>${data.nomina.totalMontoFeriados.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{data.nomina.totalHorasFeriado} hs feriado</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Costo Promedio / Empleado</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>${data.inversion.costoPromedioEmpleado.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>En el período seleccionado</div>
                </div>
            </div>

            {/* Tendencia Semanal */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>📈 Tendencia Semanal de Inversión</h3>
                <div style={{ height: '300px' }}>
                    {tendencia.length > 0 ? (
                        <Line data={tendenciaChartData} options={{
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' as const } },
                            scales: { y: { beginAtZero: true, ticks: { callback: (value: string | number) => '$' + value.toLocaleString() } } }
                        }} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)' }}>
                            No hay datos de tendencia para el período seleccionado.
                        </div>
                    )}
                </div>
            </div>

            {/* Bar Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>💰 Inversión Salarial por Área</h3>
                    <div style={{ height: '300px' }}>
                        {data.nomina.porArea.length > 0 ? (
                            <Bar data={payrollChartData} options={barOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)' }}>Sin datos</div>
                        )}
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>⚡ Top Empleados - Costo Horas Extras</h3>
                    <div style={{ height: '300px' }}>
                        {topExtrasEmployees.length > 0 ? (
                            <Bar data={extrasChartData} options={barOptions} />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-400)' }}>No hay horas extras en este periodo.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Planilla de Liquidaciones */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>📋 Planilla de Liquidaciones</h3>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <select className="form-select" value={filtroConcepto} onChange={e => setFiltroConcepto(e.target.value)} style={{ height: '36px', padding: '4px 12px' }}>
                            <option value="todos">Todos los conceptos</option>
                            {data.nomina.conceptos.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Empleado</th>
                                <th>Hs Extras</th>
                                <th>Ingresos</th>
                                <th>Descuentos</th>
                                <th>Neto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDetalle.map(l => (
                                <Fragment key={l.id}>
                                    <tr>
                                        <td>
                                            <button onClick={() => setExpandedRow(expandedRow === l.id ? null : l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 'var(--space-1)' }}>
                                                {expandedRow === l.id ? '▼' : '▶'}
                                            </button>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{l.empleado}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{l.hsExtras} hs</div>
                                            {l.montoExtras > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>${l.montoExtras.toLocaleString()}</div>}
                                        </td>
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
                                                        {l.conceptos?.map((item, idx) => (
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
        </div>
    )
}
