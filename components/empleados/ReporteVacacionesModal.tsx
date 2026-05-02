"use client"

import { useState, useEffect } from 'react'

interface VacationHistoryItem {
    id: string
    nombre: string
    fechaIngreso: string | null
    antiguedad: number
    diasTotales: number
    diasTomados: number
    diasPendientes: number
    detalles: {
        id: string
        fecha: string
        dias: number
        monto: number
        goce: string
    }[]
}

export function ReporteVacacionesModal({ onClose }: { onClose: () => void }) {
    const [anio, setAnio] = useState(new Date().getFullYear())
    const [datos, setDatos] = useState<VacationHistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEmp, setSelectedEmp] = useState<string | null>(null)

    useEffect(() => {
        fetchHistory()
    }, [anio])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/liquidaciones/vacaciones/history?anio=${anio}`)
            if (res.ok) {
                const json = await res.json()
                setDatos(json)
            }
        } catch (error) {
            console.error('Error fetching vacation history:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh' }}>
                <div className="modal-header">
                    <h2>📊 Seguimiento de Vacaciones</h2>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                        <select 
                            className="form-input" 
                            value={anio} 
                            onChange={e => setAnio(parseInt(e.target.value))}
                            style={{ width: '120px', marginBottom: 0 }}
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                    </div>
                </div>

                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    {loading ? (
                        <div className="empty-state">
                            <div className="spinner"></div>
                            <p>Calculando antigüedad y saldos...</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Empleado</th>
                                        <th>Ingreso</th>
                                        <th style={{ textAlign: 'center' }}>Antigüedad</th>
                                        <th style={{ textAlign: 'center' }}>Corresponden</th>
                                        <th style={{ textAlign: 'center' }}>Tomados</th>
                                        <th style={{ textAlign: 'center' }}>Pendientes</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {datos.map(emp => {
                                        const pct = (emp.diasTomados / emp.diasTotales) * 100
                                        const isComplete = emp.diasPendientes === 0
                                        
                                        return (
                                            <tr key={emp.id} style={{ backgroundColor: selectedEmp === emp.id ? 'var(--color-gray-50)' : 'transparent' }}>
                                                <td>
                                                    <div style={{ fontWeight: 'bold' }}>{emp.nombre}</div>
                                                </td>
                                                <td>{emp.fechaIngreso ? new Date(emp.fechaIngreso).toLocaleDateString('es-AR') : '-'}</td>
                                                <td style={{ textAlign: 'center' }}>{emp.antiguedad} años</td>
                                                <td style={{ textAlign: 'center' }}><strong>{emp.diasTotales}</strong></td>
                                                <td style={{ textAlign: 'center', color: 'var(--color-primary)' }}>{emp.diasTomados}</td>
                                                <td style={{ textAlign: 'center', color: emp.diasPendientes > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                                    <strong>{emp.diasPendientes}</strong>
                                                </td>
                                                <td>
                                                    <div style={{ width: '100px', height: '8px', backgroundColor: 'var(--color-gray-200)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                                                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: isComplete ? 'var(--color-success)' : 'var(--color-primary)' }}></div>
                                                    </div>
                                                    <div style={{ fontSize: '10px', color: 'var(--color-gray-500)', marginTop: '2px' }}>
                                                        {isComplete ? 'Completado' : `${emp.diasTomados}/${emp.diasTotales} días`}
                                                    </div>
                                                </td>
                                                <td>
                                                    <button 
                                                        className="btn btn-ghost btn-sm" 
                                                        onClick={() => setSelectedEmp(selectedEmp === emp.id ? null : emp.id)}
                                                    >
                                                        {selectedEmp === emp.id ? 'Ocultar' : 'Ver Detalle'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {selectedEmp && (
                        <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                            <h3 style={{ marginBottom: 'var(--space-4)' }}>Historial de Liquidaciones de Vacaciones - {datos.find(d => d.id === selectedEmp)?.nombre}</h3>
                            <div className="table-container">
                                <table className="table" style={{ backgroundColor: 'white' }}>
                                    <thead>
                                        <tr>
                                            <th>Fecha Liquidación</th>
                                            <th>Días</th>
                                            <th>Periodo de Goce</th>
                                            <th style={{ textAlign: 'right' }}>Monto Liquidado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datos.find(d => d.id === selectedEmp)?.detalles.length ? (
                                            datos.find(d => d.id === selectedEmp)?.detalles.map(det => (
                                                <tr key={det.id}>
                                                    <td>{new Date(det.fecha).toLocaleDateString('es-AR')}</td>
                                                    <td>{det.dias} días</td>
                                                    <td>{det.goce}</td>
                                                    <td style={{ textAlign: 'right' }}>${det.monto.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No hay liquidaciones de vacaciones registradas para este año.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-primary" onClick={onClose}>Cerrar Reporte</button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
