'use client'

import { useState, Fragment } from 'react'

interface TabLegajoProps {
    data: any
}

export default function TabLegajo({ data }: TabLegajoProps) {
    const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null)

    if (!data.historico) {
        return (
            <div className="card shadow-sm" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>👤</div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-gray-600)', marginBottom: 'var(--space-2)' }}>Legajo Individual</h3>
                <p style={{ color: 'var(--color-gray-400)' }}>Seleccioná un empleado del filtro superior para ver su legajo individual.</p>
            </div>
        )
    }

    const h = data.historico
    const kpis = h.kpis

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Neto Acumulado</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-success)' }}>${kpis.totalNeto.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{kpis.cantidadLiquidaciones} liquidaciones</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Promedio Semanal</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>${kpis.promedioNetoPorLiquidacion.toLocaleString()}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Hs Extras Totales</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#f59e0b' }}>{kpis.totalHsExtras} hs</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Acumulado: ${kpis.totalMontoHsExtras?.toLocaleString() || 0}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Ausentes</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: kpis.totalDiasAusentes > 0 ? 'var(--color-danger)' : 'inherit' }}>{kpis.totalDiasAusentes}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{kpis.totalDiasJustificados} justificados</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Días Trabajados</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{kpis.totalDiasTrabajados}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #06b6d4' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Puntualidad</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: kpis.puntualidad >= 90 ? 'var(--color-success)' : kpis.puntualidad >= 70 ? '#f59e0b' : 'var(--color-danger)' }}>
                        {kpis.puntualidad}%
                    </div>
                </div>
                {kpis.sanciones > 0 && (
                    <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #7c3aed' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Sanciones</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: '#7c3aed' }}>{kpis.sanciones}</div>
                    </div>
                )}
                {kpis.deudaPendiente > 0 && (
                    <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid var(--color-danger)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Préstamos</div>
                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-danger)' }}>${kpis.deudaPendiente.toLocaleString()}</div>
                    </div>
                )}
            </div>

            {/* Historial de Liquidaciones */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                    📋 Historial de Liquidaciones — {h.empleado?.nombre} {h.empleado?.apellido || ''}
                </h3>
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
                            {h.semanas.length === 0 ? (
                                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>No hay liquidaciones registradas.</td></tr>
                            ) : h.semanas.map((s: any) => (
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
    )
}
