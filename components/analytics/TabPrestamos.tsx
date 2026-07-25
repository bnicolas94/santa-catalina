'use client'

import { useState, Fragment } from 'react'
import type { AnalyticsData, AnalyticsPrestamo } from './analytics.types'

interface TabPrestamosProps {
    data: AnalyticsData
}

export default function TabPrestamos({ data }: TabPrestamosProps) {
    const [expandedPrestamo, setExpandedPrestamo] = useState<string | null>(null)
    const [sortedDetalle, setSortedDetalle] = useState<AnalyticsPrestamo[] | null>(null)

    const detalle = sortedDetalle || data.prestamos.detalle

    const sortBy = (field: string) => {
        const sorted = [...data.prestamos.detalle].sort((a, b) => {
            if (field === 'empleado') return a.empleado.localeCompare(b.empleado)
            const clave = field as 'montoTotal' | 'pagado' | 'saldo'
            return b[clave] - a[clave]
        })
        setSortedDetalle(sorted)
    }

    return (
        <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Total a Recuperar</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-danger)' }}>
                        ${data.prestamos.totalDeuda.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Saldo pendiente de cobro</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Préstamos como % de Nómina</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: data.prestamos.porcentajeNomina > 10 ? '#f59e0b' : 'inherit' }}>
                        {data.prestamos.porcentajeNomina}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Descuentos: ${data.prestamos.descuentosPeriodo.toLocaleString()}</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Proyección de Recupero</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)' }}>
                        {data.prestamos.semanasRecupero} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400 }}>semanas</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Estimación al ritmo actual</div>
                </div>
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 600 }}>Descuentos del Período</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, marginTop: 'var(--space-2)', color: 'var(--color-success)' }}>
                        ${data.prestamos.descuentosPeriodo.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>Monto recuperado en el período</div>
                </div>
            </div>

            {/* Tabla de Préstamos */}
            <div className="card shadow-sm" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>💰 Préstamos y Adelantos Activos</h3>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>Saldos pendientes de cobro consolidado por empleado.</p>
                    </div>
                </div>

                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th></th>
                                <th style={{ cursor: 'pointer' }} onClick={() => sortBy('empleado')}>Empleado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => sortBy('montoTotal')}>Monto Otorgado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => sortBy('pagado')}>Monto Recuperado ↕</th>
                                <th style={{ cursor: 'pointer' }} onClick={() => sortBy('saldo')}>Saldo Pendiente ↕</th>
                                <th>Cuotas</th>
                                <th style={{ width: '200px' }}>Progreso</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detalle.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                        No hay préstamos activos en este momento.
                                    </td>
                                </tr>
                            ) : (
                                detalle.map(p => (
                                    <Fragment key={p.id}>
                                        <tr>
                                            <td>
                                                {p.prestamosActivos > 1 && (
                                                    <button
                                                        onClick={() => setExpandedPrestamo(expandedPrestamo === p.id ? null : p.id)}
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
                                                            {p.listaPrestamos.map(item => (
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
        </div>
    )
}
