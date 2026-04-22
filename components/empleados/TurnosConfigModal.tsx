'use client'

import { useState, useEffect } from 'react'

interface Turno {
    id: string
    nombre: string
    descripcion: string | null
    horaInicio: string
    horaFin: string
    toleranciaMinutos: number
    activo: boolean
    _count?: { empleados: number }
}

export default function TurnosConfigModal({ onClose }: { onClose: () => void }) {
    const [turnos, setTurnos] = useState<Turno[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        horaInicio: '08:00',
        horaFin: '17:00',
        toleranciaMinutos: 15
    })

    const fetchTurnos = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/turnos')
            if (res.ok) {
                const data = await res.json()
                setTurnos(data)
            }
        } catch (error) {
            console.error('Error fetching turnos:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTurnos()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const isEdit = !!editingId
            const method = isEdit ? 'PUT' : 'POST'
            const body = isEdit ? { ...formData, id: editingId } : formData

            const res = await fetch('/api/turnos', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar el turno')
            }

            setFormData({ nombre: '', descripcion: '', horaInicio: '08:00', horaFin: '17:00', toleranciaMinutos: 15 })
            setEditingId(null)
            fetchTurnos()
        } catch (error: any) {
            alert(error.message)
        }
    }

    const handleEdit = (turno: Turno) => {
        setEditingId(turno.id)
        setFormData({
            nombre: turno.nombre,
            descripcion: turno.descripcion || '',
            horaInicio: turno.horaInicio,
            horaFin: turno.horaFin,
            toleranciaMinutos: turno.toleranciaMinutos
        })
    }

    const handleToggleActive = async (turno: Turno) => {
        try {
            if (turno.activo && (turno._count?.empleados || 0) > 0) {
                alert(`No se puede desactivar este turno porque tiene ${turno._count?.empleados} empleado(s) activos asignados.`)
                return
            }

            const method = turno.activo ? 'DELETE' : 'PUT'
            const url = turno.activo ? `/api/turnos?id=${turno.id}` : '/api/turnos'
            const body = turno.activo ? null : JSON.stringify({ id: turno.id, activo: true })

            const res = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body || undefined
            })

            if (!res.ok) throw new Error('Error al cambiar el estado del turno')
            
            fetchTurnos()
        } catch (error: any) {
            alert(error.message)
        }
    }

    const formatTime = (time: string) => {
        const [h, m] = time.split(':')
        const date = new Date()
        date.setHours(parseInt(h), parseInt(m))
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%' }}>
                <div className="modal-header">
                    <h2>🕒 Configuración de Turnos</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', gap: 'var(--space-6)', maxHeight: '70vh', overflowY: 'auto' }}>
                    {/* Lista de Turnos */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: 'var(--space-3)' }}>Turnos Registrados</h3>
                        {loading ? (
                            <p style={{ color: 'var(--color-gray-500)' }}>Cargando turnos...</p>
                        ) : turnos.length === 0 ? (
                            <p style={{ color: 'var(--color-gray-500)' }}>No hay turnos configurados.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {turnos.map(turno => (
                                    <div key={turno.id} style={{
                                        padding: 'var(--space-3)',
                                        border: '1px solid var(--color-gray-200)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: turno.activo ? 'white' : 'var(--color-gray-50)',
                                        opacity: turno.activo ? 1 : 0.6,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-2)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontWeight: 600 }}>{turno.nombre}</h4>
                                                {turno.descripcion && (
                                                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{turno.descripcion}</p>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                <button 
                                                    className="btn btn-ghost btn-sm btn-icon" 
                                                    onClick={() => handleEdit(turno)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className="btn btn-ghost btn-sm btn-icon" 
                                                    onClick={() => handleToggleActive(turno)}
                                                    title={turno.activo ? "Desactivar" : "Activar"}
                                                >
                                                    {turno.activo ? '❌' : '✅'}
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                                <span style={{ color: 'var(--color-gray-500)' }}>Horario:</span>
                                                <strong>{formatTime(turno.horaInicio)} - {formatTime(turno.horaFin)}</strong>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                                <span style={{ color: 'var(--color-warning)' }} title="Tolerancia de llegada tarde">⏱️</span>
                                                <strong>{turno.toleranciaMinutos} min</strong>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginLeft: 'auto' }}>
                                                <span className="badge badge-info">{turno._count?.empleados || 0} Empleados</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Formulario */}
                    <div style={{ width: '300px', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', height: 'fit-content' }}>
                        <h3 style={{ marginBottom: 'var(--space-4)' }}>{editingId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Nombre del Turno</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    required 
                                    placeholder="Ej: Mañana" 
                                    value={formData.nombre}
                                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Descripción (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Ej: Lun a Vie - Operarios" 
                                    value={formData.descripcion}
                                    onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                />
                            </div>
                            
                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Hora Inicio</label>
                                    <input 
                                        type="time" 
                                        className="form-input" 
                                        required 
                                        value={formData.horaInicio}
                                        onChange={e => setFormData({...formData, horaInicio: e.target.value})}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Hora Fin</label>
                                    <input 
                                        type="time" 
                                        className="form-input" 
                                        required 
                                        value={formData.horaFin}
                                        onChange={e => setFormData({...formData, horaFin: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Tolerancia Tardanza (minutos)</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    required 
                                    min="0"
                                    max="60"
                                    value={formData.toleranciaMinutos}
                                    onChange={e => setFormData({...formData, toleranciaMinutos: parseInt(e.target.value) || 0})}
                                />
                                <small style={{ color: 'var(--color-gray-500)', marginTop: '2px', display: 'block' }}>
                                    Tiempo de gracia antes de marcar tardanza.
                                </small>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                {editingId && (
                                    <button 
                                        type="button" 
                                        className="btn btn-ghost" 
                                        onClick={() => {
                                            setEditingId(null);
                                            setFormData({ nombre: '', descripcion: '', horaInicio: '08:00', horaFin: '17:00', toleranciaMinutos: 15 });
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                                    {editingId ? 'Actualizar' : 'Crear Turno'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                }
                .modal {
                    background: white;
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }
                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: var(--space-4) var(--space-6);
                    border-bottom: 1px solid var(--color-gray-200);
                }
                .modal-header h2 {
                    margin: 0;
                    font-size: var(--text-lg);
                    font-weight: 600;
                }
                .modal-body {
                    padding: var(--space-6);
                }
            `}</style>
        </div>
    )
}
