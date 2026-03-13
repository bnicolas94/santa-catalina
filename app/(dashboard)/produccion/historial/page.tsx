'use client'

import React, { useState, useEffect } from 'react'

interface HistorialItem {
    id: string
    fecha: string
    empleado: { nombre: string, apellido: string | null }
    concepto: { nombre: string }
    ubicacion: { nombre: string }
    observaciones: string | null
}

const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString)
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date)
    } catch (e) {
        return dateString
    }
}



export default function HistorialPosicionamiento() {
    const [desde, setDesde] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
    const [historial, setHistorial] = useState<HistorialItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchHistorial()
    }, [])

    async function fetchHistorial() {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/produccion/historial?desde=${desde}&hasta=${hasta}`)
            if (!res.ok) throw new Error('Error al cargar historial')
            const data = await res.json()
            setHistorial(data)
        } catch (err) {
            setError('Error al obtener el historial')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container" style={{ padding: 'var(--space-6)' }}>
            <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
                <h1>📜 Historial de Posicionamiento</h1>
                <p style={{ color: 'var(--color-gray-500)' }}>Reporte de estaciones de trabajo por operario</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Desde</label>
                        <input type="date" className="form-input" value={desde} onChange={e => setDesde(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Hasta</label>
                        <input type="date" className="form-input" value={hasta} onChange={e => setHasta(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={fetchHistorial}>🔍 Buscar</button>
                </div>
            </div>

            {error && <div className="toast toast-error">{error}</div>}

            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Operario</th>
                                <th>Concepto/Estación</th>
                                <th>Ubicación</th>
                                <th>Observaciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center' }}>Cargando historial...</td></tr>
                            ) : historial.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center' }}>No se encontraron registros para el período seleccionado.</td></tr>
                            ) : (
                                historial.map((item: HistorialItem) => (
                                    <tr key={item.id}>
                                        <td>{formatDate(item.fecha)}</td>

                                        <td style={{ fontWeight: 600 }}>{item.empleado.nombre} {item.empleado.apellido}</td>
                                        <td><span className="badge badge-primary" style={{ fontSize: '11px' }}>{item.concepto.nombre}</span></td>
                                        <td style={{ fontSize: '12px' }}>{item.ubicacion.nombre}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{item.observaciones || '—'}</td>
                                    </tr>

                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
