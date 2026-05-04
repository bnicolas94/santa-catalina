'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface InasistenciasModalProps {
    isOpen: boolean
    onClose: () => void
    empleados: any[]
}

export function InasistenciasModal({ isOpen, onClose, empleados }: InasistenciasModalProps) {
    const [activeTab, setActiveTab] = useState<'lista' | 'resumen' | 'config'>('lista')
    const [inasistencias, setInasistencias] = useState<any[]>([])
    const [resumen, setResumen] = useState<any[]>([])
    const [alertas, setAlertas] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    
    // Form state
    const [showForm, setShowForm] = useState(false)
    const [newInasistencia, setNewInasistencia] = useState({
        empleadoId: '',
        fecha: new Date().toISOString().split('T')[0],
        fechaHasta: '',
        tipo: 'INJUSTIFICADA',
        motivo: '',
        tieneCertificado: false,
        observaciones: ''
    })

    useEffect(() => {
        if (isOpen) {
            fetchInasistencias()
            fetchResumen()
            fetchConfig()
        }
    }, [isOpen])

    const fetchInasistencias = async () => {
        const res = await fetch('/api/empleados/inasistencias')
        const data = await res.json()
        setInasistencias(data)
    }

    const fetchResumen = async () => {
        const res = await fetch('/api/empleados/inasistencias/resumen')
        const data = await res.json()
        setResumen(data)
    }

    const fetchConfig = async () => {
        const res = await fetch('/api/empleados/inasistencias/alertas')
        const data = await res.json()
        setAlertas(data)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/empleados/inasistencias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newInasistencia)
            })
            if (res.ok) {
                setShowForm(false)
                fetchInasistencias()
                fetchResumen()
                setNewInasistencia({
                    empleadoId: '',
                    fecha: new Date().toISOString().split('T')[0],
                    fechaHasta: '',
                    tipo: 'INJUSTIFICADA',
                    motivo: '',
                    tieneCertificado: false,
                    observaciones: ''
                })
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
            <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>🚨 Gestión de Inasistencias y Ausentismo</h2>
                    <button onClick={onClose} className="btn-close">&times;</button>
                </div>

                <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-gray-200)', marginBottom: 'var(--space-4)' }}>
                    <button className={`tab-btn ${activeTab === 'lista' ? 'active' : ''}`} onClick={() => setActiveTab('lista')}>📋 Registro Diario</button>
                    <button className={`tab-btn ${activeTab === 'resumen' ? 'active' : ''}`} onClick={() => setActiveTab('resumen')}>📊 Resumen de Alertas</button>
                    <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Configuración</button>
                </div>

                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-4)' }}>
                    {activeTab === 'lista' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3>Historial de Ausencias</h3>
                                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                                    {showForm ? 'Cancelar' : '➕ Registrar Inasistencia'}
                                </button>
                            </div>

                            {showForm && (
                                <form onSubmit={handleSubmit} className="card shadow-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Empleado</label>
                                            <select 
                                                className="form-select" 
                                                value={newInasistencia.empleadoId} 
                                                onChange={e => setNewInasistencia({...newInasistencia, empleadoId: e.target.value})}
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Desde</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={newInasistencia.fecha}
                                                onChange={e => setNewInasistencia({...newInasistencia, fecha: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Hasta (Opcional)</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={newInasistencia.fechaHasta}
                                                onChange={e => setNewInasistencia({...newInasistencia, fechaHasta: e.target.value})}
                                                placeholder="Solo si es un rango..."
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tipo de Inasistencia</label>
                                            <select 
                                                className="form-select" 
                                                value={newInasistencia.tipo}
                                                onChange={e => setNewInasistencia({...newInasistencia, tipo: e.target.value})}
                                            >
                                                <option value="INJUSTIFICADA">Injustificada (Sin Aviso)</option>
                                                <option value="CON_AVISO_INJUSTIFICADA">Con Aviso - Injustificada</option>
                                                <option value="JUSTIFICADA_PAGA">Justificada (Paga)</option>
                                                <option value="JUSTIFICADA_NO_PAGA">Justificada (No Paga)</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={newInasistencia.tieneCertificado}
                                                    onChange={e => setNewInasistencia({...newInasistencia, tieneCertificado: e.target.checked})}
                                                />
                                                Presentó Certificado Médico
                                            </label>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo / Observaciones</label>
                                        <textarea 
                                            className="form-input" 
                                            rows={2}
                                            value={newInasistencia.observaciones}
                                            onChange={e => setNewInasistencia({...newInasistencia, observaciones: e.target.value})}
                                            placeholder="Detalles adicionales..."
                                        ></textarea>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Guardando...' : 'Confirmar Registro'}
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
                                            <th>Certif.</th>
                                            <th>Observaciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inasistencias.map(i => (
                                            <tr key={i.id}>
                                                <td>{format(new Date(i.fecha), 'dd/MM/yyyy')}</td>
                                                <td style={{ fontWeight: 600 }}>{i.empleado.nombre} {i.empleado.apellido}</td>
                                                <td>
                                                    <span className={`badge badge-${i.tipo.includes('INJUSTIFICADA') ? 'danger' : 'info'}`}>
                                                        {i.tipo.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{i.tieneCertificado ? '✅' : '❌'}</td>
                                                <td style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{i.observaciones}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'resumen' && (
                        <div>
                            <h3 style={{ marginBottom: 'var(--space-4)' }}>Status de Ausentismo y Alertas</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                                {resumen.filter(r => r.alertasDisparadas.length > 0).map(r => (
                                    <div key={r.id} className="card shadow-sm" style={{ borderLeft: '4px solid var(--color-danger)', padding: 'var(--space-4)' }}>
                                        <h4 style={{ margin: 0 }}>{r.nombre}</h4>
                                        <div style={{ marginTop: 'var(--space-3)' }}>
                                            {r.alertasDisparadas.map((a: any, idx: number) => (
                                                <div key={idx} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 'var(--space-2)', borderRadius: '4px', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-danger)' }}>
                                                        <span>🚨 {a.tipo.replace(/_/g, ' ')}</span>
                                                        <span>{a.actual} / {a.limite}</span>
                                                    </div>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#B91C1C', fontWeight: 600 }}>
                                                        Sugerencia: {a.accion || 'Sin acción configurada'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {resumen.filter(r => r.alertasDisparadas.length > 0).length === 0 && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-10)', color: 'var(--color-gray-400)' }}>
                                    ✅ No hay empleados que superen los límites de ausentismo configurados.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3>Configuración de Umbrales de Alerta</h3>
                                <button className="btn btn-outline btn-sm" onClick={() => {
                                    // Logic to add new alert config
                                }}>➕ Nueva Regla</button>
                            </div>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Tipo de Inasistencia</th>
                                            <th>Límite Máximo</th>
                                            <th>Periodo (Días)</th>
                                            <th>Acción Sugerida</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {alertas.map(a => (
                                            <tr key={a.id}>
                                                <td>{a.tipoInasistencia.replace(/_/g, ' ')}</td>
                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.limiteMaximo}</td>
                                                <td style={{ textAlign: 'center' }}>Cada {a.periodoDias} días</td>
                                                <td><span className="badge badge-warning">{a.accionSugerida}</span></td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm">Editar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="alert alert-info" style={{ marginTop: 'var(--space-6)' }}>
                                💡 Estas reglas sirven para automatizar el control. Cuando un empleado llega al límite dentro del periodo de días indicado, aparecerá automáticamente en la pestaña de <strong>Resumen de Alertas</strong>.
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
                    .tab-btn:hover {
                        background-color: var(--color-gray-50);
                    }
                `}</style>
            </div>
        </div>
    )
}
