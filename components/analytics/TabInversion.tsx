'use client'

import { Fragment, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import type { AnalyticsData } from './analytics.types'
import styles from './analytics.module.css'

interface TabInversionProps {
    data: AnalyticsData
    filtroConcepto: string
    setFiltroConcepto: (v: string) => void
    expandedRow: string | null
    setExpandedRow: (v: string | null) => void
}

export default function TabInversion({ data, filtroConcepto, setFiltroConcepto, expandedRow, setExpandedRow }: TabInversionProps) {
    const [filtroTipo, setFiltroTipo] = useState('NORMAL')
    const filteredDetalle = data.nomina.detalle.filter(liq => {
        const coincideTipo = filtroTipo === 'todos' || liq.tipo === filtroTipo
        const coincideConcepto = filtroConcepto === 'todos' || liq.conceptos.some(c => c.nombre === filtroConcepto)
        return coincideTipo && coincideConcepto
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
        .filter(l => l.tipo === 'NORMAL' && l.hsExtras > 0)
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
            <div className={styles.sectionIntro}>
                <div>
                    <h2>Inversión y nómina</h2>
                    <p>Los indicadores operativos usan únicamente sueldo habitual; los pagos especiales se muestran por separado.</p>
                </div>
                <span className={styles.sectionTag}>Total general: ${data.nomina.totalGeneral.toLocaleString('es-AR')}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                {data.nomina.porTipo.map(grupo => (
                    <button key={grupo.tipo} type="button" onClick={() => setFiltroTipo(grupo.tipo)} style={{ textAlign: 'left', padding: 'var(--space-4)', borderRadius: '12px', border: filtroTipo === grupo.tipo ? '2px solid var(--color-primary)' : '1px solid var(--color-gray-200)', background: filtroTipo === grupo.tipo ? '#eff6ff' : 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(15,23,42,.04)' }}>
                        <span style={{ display: 'block', color: 'var(--color-gray-500)', fontSize: '10px', fontWeight: 750, textTransform: 'uppercase', letterSpacing: '.05em' }}>{grupo.etiqueta}</span>
                        <strong style={{ display: 'block', marginTop: '7px', color: 'var(--color-gray-900)', fontSize: '20px' }}>${grupo.total.toLocaleString('es-AR')}</strong>
                        <small style={{ color: 'var(--color-gray-400)' }}>{grupo.cantidad} {grupo.cantidad === 1 ? 'liquidación' : 'liquidaciones'}</small>
                    </button>
                ))}
            </div>

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
                    <div><h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Planilla de Liquidaciones</h3><p style={{ margin: '3px 0 0', color: 'var(--color-gray-500)', fontSize: '11px' }}>Filtrá primero por naturaleza del pago y luego por concepto adicional.</p></div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <select aria-label="Tipo de liquidación" className="form-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ height: '36px', padding: '4px 12px' }}>
                                <option value="todos">Todos los tipos</option>
                                {data.nomina.porTipo.map(grupo => <option key={grupo.tipo} value={grupo.tipo}>{grupo.etiqueta}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                        <select className="form-select" value={filtroConcepto} onChange={e => setFiltroConcepto(e.target.value)} style={{ height: '36px', padding: '4px 12px' }}>
                            <option value="todos">Todos los conceptos</option>
                            {data.nomina.conceptos.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        </div>
                    </div>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Empleado</th>
                                <th>Tipo</th>
                                <th>Hs Extras</th>
                                <th>Ingresos</th>
                                <th>Descuentos</th>
                                <th>Neto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDetalle.length === 0 ? <tr><td colSpan={7} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-gray-400)' }}>No hay liquidaciones para los filtros seleccionados.</td></tr> : filteredDetalle.map(l => (
                                <Fragment key={l.id}>
                                    <tr>
                                        <td>
                                            <button onClick={() => setExpandedRow(expandedRow === l.id ? null : l.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 'var(--space-1)' }}>
                                                {expandedRow === l.id ? '▼' : '▶'}
                                            </button>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{l.empleado}</td>
                                        <td><span className="badge" style={{ fontSize: '9px', background: l.tipo === 'NORMAL' ? '#eff6ff' : l.tipo === 'SAC' ? '#f5f3ff' : l.tipo === 'VACACIONES' ? '#ecfdf5' : 'var(--color-gray-100)', color: l.tipo === 'NORMAL' ? '#1d4ed8' : l.tipo === 'SAC' ? '#6d28d9' : l.tipo === 'VACACIONES' ? '#047857' : 'var(--color-gray-600)' }}>{l.tipoLabel}</span></td>
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
                                            <td colSpan={7} style={{ padding: '0', background: 'var(--color-gray-50)' }}>
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
