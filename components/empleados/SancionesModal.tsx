'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SancionesModalProps {
    isOpen: boolean
    onClose: () => void
    empleados: any[]
}

export function SancionesModal({ isOpen, onClose, empleados }: SancionesModalProps) {
    const [activeTab, setActiveTab] = useState<'lista' | 'config'>('lista')
    const [sanciones, setSanciones] = useState<any[]>([])
    const [alertas, setAlertas] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    
    // Form state para sanción manual
    const [showForm, setShowForm] = useState(false)
    const [newSancion, setNewSancion] = useState({
        empleadoId: '',
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'APERCIBIMIENTO',
        motivo: '',
        observaciones: ''
    })

    useEffect(() => {
        if (isOpen) {
            fetchSanciones()
            fetchConfig()
        }
    }, [isOpen])

    const fetchSanciones = async () => {
        const res = await fetch('/api/empleados/sanciones')
        const data = await res.json()
        setSanciones(data)
    }

    const fetchConfig = async () => {
        const res = await fetch('/api/empleados/inasistencias/alertas')
        const data = await res.json()
        setAlertas(data)
    }

    const handleSubmitSancion = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/empleados/sanciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSancion)
            })
            if (res.ok) {
                setShowForm(false)
                fetchSanciones()
                setNewSancion({
                    empleadoId: '',
                    fecha: new Date().toISOString().split('T')[0],
                    tipo: 'APERCIBIMIENTO',
                    motivo: '',
                    observaciones: ''
                })
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Alertas form state
    const [showAlertaForm, setShowAlertaForm] = useState(false)
    const [editingAlerta, setEditingAlerta] = useState<any>(null)
    const [alertaForm, setAlertaForm] = useState({
        tipoInasistencia: 'TARDANZA',
        limiteMaximo: 3,
        periodoDias: 30,
        accionSugerida: '',
        autoSancionar: false,
        tipoSancionAuto: 'APERCIBIMIENTO'
    })

    const handleSaveAlerta = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const url = editingAlerta ? `/api/empleados/inasistencias/alertas/${editingAlerta.id}` : '/api/empleados/inasistencias/alertas'
            const method = editingAlerta ? 'PUT' : 'POST'
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertaForm)
            })
            
            if (res.ok) {
                setShowAlertaForm(false)
                setEditingAlerta(null)
                fetchConfig()
            } else {
                const err = await res.json()
                alert('Error al guardar: ' + err.error)
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión al servidor')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAlerta = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta regla de sanción?')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/empleados/inasistencias/alertas/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchConfig()
            } else {
                alert('Error al eliminar')
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>⚖️ Sanciones y Apercibimientos</h2>
                    <button onClick={onClose} className="btn-close">&times;</button>
                </div>

                <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: 'var(--space-4)' }}>
                    <button className={`tab-btn ${activeTab === 'lista' ? 'active' : ''}`} onClick={() => setActiveTab('lista')}>📋 Historial</button>
                    <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Reglas de Sanción Auto</button>
                </div>

                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-4)' }}>
                    {activeTab === 'lista' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3>Registro de Sanciones</h3>
                                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                                    {showForm ? 'Cancelar' : '➕ Emitir Sanción Manual'}
                                </button>
                            </div>

                            {showForm && (
                                <form onSubmit={handleSubmitSancion} className="card shadow-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Empleado</label>
                                            <select 
                                                className="form-select" 
                                                value={newSancion.empleadoId} 
                                                onChange={e => setNewSancion({...newSancion, empleadoId: e.target.value})}
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Fecha</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={newSancion.fecha}
                                                onChange={e => setNewSancion({...newSancion, fecha: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tipo de Sanción</label>
                                            <select 
                                                className="form-select" 
                                                value={newSancion.tipo}
                                                onChange={e => setNewSancion({...newSancion, tipo: e.target.value})}
                                            >
                                                <option value="APERCIBIMIENTO">Apercibimiento</option>
                                                <option value="SANCION">Sanción</option>
                                                <option value="SUSPENSION">Suspensión</option>
                                                <option value="DESPIDO">Despido (Aviso)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            value={newSancion.motivo}
                                            onChange={e => setNewSancion({...newSancion, motivo: e.target.value})}
                                            placeholder="Ej: Llegadas tarde reiteradas, falta injustificada..."
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Observaciones Adicionales</label>
                                        <textarea 
                                            className="form-input" 
                                            rows={2}
                                            value={newSancion.observaciones}
                                            onChange={e => setNewSancion({...newSancion, observaciones: e.target.value})}
                                        ></textarea>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Guardando...' : 'Confirmar Sanción'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Empleado</th>
                                            <th>Tipo</th>
                                            <th>Motivo</th>
                                            <th>Origen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sanciones.map(s => (
                                            <tr key={s.id}>
                                                <td>{format(new Date(s.fecha), 'dd/MM/yyyy')}</td>
                                                <td style={{ fontWeight: 600 }}>{s.empleado.nombre} {s.empleado.apellido}</td>
                                                <td>
                                                    <span className={`badge badge-${s.tipo === 'APERCIBIMIENTO' ? 'warning' : 'danger'}`}>
                                                        {s.tipo}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '13px' }}>{s.motivo}</td>
                                                <td>
                                                    {s.alertaId ? (
                                                        <span title={s.observaciones} style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600 }}>⚙️ AUTOMÁTICO</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-gray-400)', fontSize: '11px' }}>👤 MANUAL</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {sanciones.length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                                    No hay sanciones registradas.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3>Reglas de Sanción Automática</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => {
                                    setEditingAlerta(null)
                                    setAlertaForm({
                                        tipoInasistencia: 'TARDANZA',
                                        limiteMaximo: 3,
                                        periodoDias: 30,
                                        accionSugerida: '',
                                        autoSancionar: false,
                                        tipoSancionAuto: 'APERCIBIMIENTO'
                                    })
                                    setShowAlertaForm(true)
                                }}>➕ Nueva Regla</button>
                            </div>

                            {showAlertaForm && (
                                <form onSubmit={handleSaveAlerta} className="card shadow-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)' }}>
                                    <h4>{editingAlerta ? 'Editar Regla' : 'Nueva Regla'}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginTop: '10px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Tipo de Falta</label>
                                            <select 
                                                className="form-select" 
                                                value={alertaForm.tipoInasistencia}
                                                onChange={e => setAlertaForm({...alertaForm, tipoInasistencia: e.target.value})}
                                            >
                                                <option value="TARDANZA">Llegada Tarde</option>
                                                <option value="INJUSTIFICADA">Injustificada</option>
                                                <option value="CON_AVISO_INJUSTIFICADA">Con Aviso - Injustificada</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Límite</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                value={alertaForm.limiteMaximo}
                                                onChange={e => setAlertaForm({...alertaForm, limiteMaximo: parseInt(e.target.value)})}
                                                min={1}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Días (Periodo)</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                value={alertaForm.periodoDias}
                                                onChange={e => setAlertaForm({...alertaForm, periodoDias: parseInt(e.target.value)})}
                                                min={1}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={alertaForm.autoSancionar}
                                                    onChange={e => setAlertaForm({...alertaForm, autoSancionar: e.target.checked})}
                                                />
                                                Aplicar Sanción Automáticamente
                                            </label>
                                        </div>
                                        {alertaForm.autoSancionar && (
                                            <div className="form-group">
                                                <label className="form-label">Sanción a Aplicar</label>
                                                <select 
                                                    className="form-select" 
                                                    value={alertaForm.tipoSancionAuto}
                                                    onChange={e => setAlertaForm({...alertaForm, tipoSancionAuto: e.target.value})}
                                                >
                                                    <option value="APERCIBIMIENTO">Apercibimiento</option>
                                                    <option value="SANCION">Sanción</option>
                                                    <option value="SUSPENSION">Suspensión</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right', marginTop: 'var(--space-4)' }}>
                                        <button type="button" className="btn btn-outline" style={{ marginRight: '10px' }} onClick={() => setShowAlertaForm(false)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Guardando...' : 'Guardar Regla'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Falta</th>
                                            <th>Umbral</th>
                                            <th>Auto</th>
                                            <th>Sanción</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alertas.map(a => (
                                            <tr key={a.id}>
                                                <td>{a.tipoInasistencia}</td>
                                                <td>{a.limiteMaximo} en {a.periodoDias} días</td>
                                                <td>{a.autoSancionar ? '✅ SI' : '❌ NO'}</td>
                                                <td>{a.autoSancionar ? a.tipoSancionAuto : 'Solo Alerta'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => {
                                                            setEditingAlerta(a)
                                                            setAlertaForm({
                                                                tipoInasistencia: a.tipoInasistencia,
                                                                limiteMaximo: a.limiteMaximo,
                                                                periodoDias: a.periodoDias,
                                                                accionSugerida: a.accionSugerida || '',
                                                                autoSancionar: a.autoSancionar || false,
                                                                tipoSancionAuto: a.tipoSancionAuto || 'APERCIBIMIENTO'
                                                            })
                                                            setShowAlertaForm(true)
                                                        }} title="Editar">✏️</button>
                                                        <button 
                                                            className="btn btn-ghost btn-sm" 
                                                            style={{ color: 'var(--color-danger)' }}
                                                            onClick={() => handleDeleteAlerta(a.id)}
                                                            title="Eliminar"
                                                        >🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <style jsx>{`
                    .modal-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2000;
                        backdrop-filter: blur(4px);
                    }
                    .modal-content {
                        background: white;
                        border-radius: var(--radius-xl);
                        box-shadow: var(--shadow-2xl);
                        padding: var(--space-6);
                        color: var(--color-gray-900);
                    }
                    .modal-tabs button {
                        padding: var(--space-3) var(--space-6);
                        border: none;
                        background: none;
                        cursor: pointer;
                        font-weight: 600;
                        color: var(--color-gray-500);
                        border-bottom: 2px solid transparent;
                    }
                    .modal-tabs button.active {
                        color: var(--color-primary);
                        border-bottom: 2px solid var(--color-primary);
                    }
                `}</style>
            </div>
        </div>
    )
}
