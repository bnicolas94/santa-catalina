"use client"

import { useState, useEffect } from 'react'

interface Fichada {
    id: string
    fechaHora: string
    tipo: 'entrada' | 'salida'
    origen: string
}

export function FichadasTab({ empleadoId }: { empleadoId: string }) {
    const [fichadas, setFichadas] = useState<Fichada[]>([])
    const [loading, setLoading] = useState(false)

    // Estados para carga manual
    const [manualOpen, setManualOpen] = useState(false)
    const [manualFecha, setManualFecha] = useState(new Date().toISOString().split('T')[0])
    const [manualHora, setManualHora] = useState('08:00')
    const [manualTipo, setManualTipo] = useState<'entrada' | 'salida'>('entrada')
    const [manualLoading, setManualLoading] = useState(false)

    // Este useEffect idealmente cargaría fichadas existentes... 
    // Por simplicidad en la UI vamos a dejar el método definido:
    const fetchFichadas = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/fichadas?empleadoId=${empleadoId}`)
            const data = await res.json()
            setFichadas(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFichadas()
    }, [empleadoId])

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setManualLoading(true)
        try {
            const tempDate = new Date(`${manualFecha}T${manualHora}:00`)
            const res = await fetch('/api/fichadas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    fechaHora: tempDate.toISOString(),
                    tipo: manualTipo,
                    origen: 'manual'
                })
            })

            if (res.ok) {
                setManualOpen(false)
                fetchFichadas()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al guardar fichada')
            }
        } catch (error) {
            console.error(error)
            alert('Error al registrar fichada manual')
        } finally {
            setManualLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card">
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Historial de Fichadas</h3>
                        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Registros de asistencia del mes en curso.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-primary" onClick={() => setManualOpen(true)}>
                            + Carga Manual
                        </button>
                        <button className="btn btn-outline" onClick={fetchFichadas}>
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '6px' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Tipo</th>
                            <th>Origen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fichadas.length > 0 ? (
                            fichadas.map((f, i) => (
                                <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{new Date(f.fechaHora).toLocaleString()}</td>
                                    <td>
                                        <span className={`badge ${f.tipo === 'entrada' ? 'badge-success' : 'badge-warning'}`}>
                                            {f.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--color-gray-500)', textTransform: 'capitalize' }}>{f.origen}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3}>
                                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                                        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: 'var(--space-3)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', textAlign: 'center' }}>Cargue fichadas manuales o importe el registro del reloj biométrico para ver información.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {manualOpen && (
                <div className="modal-overlay" onClick={() => setManualOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>Registrar Fichada Manual</h2>
                            <button onClick={() => setManualOpen(false)} className="btn btn-ghost btn-icon">✕</button>
                        </div>
                        <form onSubmit={handleManualSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input type="date" required value={manualFecha} onChange={e => setManualFecha(e.target.value)} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hora</label>
                                    <input type="time" required value={manualHora} onChange={e => setManualHora(e.target.value)} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo de Movimiento</label>
                                    <select value={manualTipo} onChange={e => setManualTipo(e.target.value as 'entrada' | 'salida')} className="form-select">
                                        <option value="entrada">Entrada</option>
                                        <option value="salida">Salida</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setManualOpen(false)} className="btn btn-ghost">Cancelar</button>
                                <button type="submit" disabled={manualLoading} className="btn btn-primary">
                                    {manualLoading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
