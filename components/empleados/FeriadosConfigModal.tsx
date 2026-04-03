"use client"

import { useState, useEffect } from 'react'

interface Feriado {
    id: string
    fecha: string
    nombre: string
}

interface FeriadosConfigModalProps {
    onClose: () => void
}

export default function FeriadosConfigModal({ onClose }: FeriadosConfigModalProps) {
    const [feriados, setFeriados] = useState<Feriado[]>([])
    const [loading, setLoading] = useState(true)
    const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: '', nombre: '' })
    const [guardando, setGuardando] = useState(false)
    const [anio, setAnio] = useState(new Date().getFullYear().toString())

    const fetchFeriados = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/feriados?anio=${anio}`)
            const data = await res.json()
            setFeriados(data)
        } catch (error) {
            console.error('Error fetching feriados:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFeriados()
    }, [anio])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoFeriado.fecha || !nuevoFeriado.nombre) return

        setGuardando(true)
        try {
            const res = await fetch('/api/feriados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoFeriado)
            })

            if (res.ok) {
                setNuevoFeriado({ fecha: '', nombre: '' })
                fetchFeriados()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al agregar feriado')
            }
        } catch (error) {
            console.error(error)
            alert('Error al comunicar con el servidor')
        } finally {
            setGuardando(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar este feriado?')) return

        try {
            const res = await fetch(`/api/feriados?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchFeriados()
            } else {
                alert('Error al eliminar')
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión')
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
                <div className="modal-header">
                    <h2>📅 Configuración de Feriados</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="form-group">
                        <label className="form-label">Filtrar por Año</label>
                        <select className="form-select" value={anio} onChange={e => setAnio(e.target.value)}>
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y.toString()}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <form onSubmit={handleAdd} style={{ backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid var(--color-gray-200)' }}>
                        <h3 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Agregar Nuevo Feriado</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '10px' }}>Fecha</label>
                                <input 
                                    type="date" 
                                    required 
                                    className="form-input" 
                                    value={nuevoFeriado.fecha} 
                                    onChange={e => setNuevoFeriado(prev => ({ ...prev, fecha: e.target.value }))} 
                                    onClick={e => e.currentTarget.showPicker?.()}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '10px' }}>Nombre / Motivo</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="form-input" 
                                    placeholder="Ej: Navidad" 
                                    value={nuevoFeriado.nombre} 
                                    onChange={e => setNuevoFeriado(prev => ({ ...prev, nombre: e.target.value }))} 
                                />
                            </div>
                        </div>
                        <button type="submit" disabled={guardando} className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-4)' }}>
                            {guardando ? 'Guardando...' : '+ Agregar Feriado'}
                        </button>
                    </form>

                    <h3 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Feriados Registrados ({anio})</h3>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>Cargando...</p>
                    ) : feriados.length > 0 ? (
                        <div className="table-container" style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Nombre</th>
                                        <th style={{ textAlign: 'right' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {feriados.map(f => (
                                        <tr key={f.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {(() => {
                                                    const parts = f.fecha.split('T')[0].split('-');
                                                    return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                })()}
                                            </td>
                                            <td>{f.nombre}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(f.id)}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>No hay feriados registrados para este año.</p>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline btn-block" onClick={onClose}>Cerrar</button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(2px); }
                .modal { background: white; border-radius: var(--radius-lg); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
