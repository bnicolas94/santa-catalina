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
    const [editingId, setEditingId] = useState<string | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [newInasistencia, setNewInasistencia] = useState({
        empleadoId: '',
        fecha: new Date().toISOString().split('T')[0],
        fechaHasta: '',
        tipo: 'INJUSTIFICADA',
        tipoPersonalizado: '',
        motivo: '',
        tieneCertificado: false,
        observaciones: '',
        minutosRetraso: ''
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
            const formData = new FormData()
            Object.entries(newInasistencia).forEach(([key, value]) => {
                if (key === 'tipo' && value === 'OTRO') {
                    formData.append(key, newInasistencia.tipoPersonalizado)
                } else {
                    formData.append(key, value.toString())
                }
            })
            if (file) {
                formData.append('file', file)
            }

            const url = editingId ? `/api/empleados/inasistencias/${editingId}` : '/api/empleados/inasistencias'
            const method = editingId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method: method,
                body: formData
            })
            if (res.ok) {
                setShowForm(false)
                setEditingId(null)
                setFile(null)
                fetchInasistencias()
                fetchResumen()
                setNewInasistencia({
                    empleadoId: '',
                    fecha: new Date().toISOString().split('T')[0],
                    fechaHasta: '',
                    tipo: 'INJUSTIFICADA',
                    tipoPersonalizado: '',
                    motivo: '',
                    tieneCertificado: false,
                    observaciones: '',
                    minutosRetraso: ''
                })
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleEditInasistencia = (i: any) => {
        setNewInasistencia({
            empleadoId: i.empleadoId,
            fecha: new Date(i.fecha).toISOString().split('T')[0],
            fechaHasta: '',
            tipo: ['INJUSTIFICADA', 'CON_AVISO_INJUSTIFICADA', 'JUSTIFICADA_PAGA', 'JUSTIFICADA_NO_PAGA', 'TARDANZA'].includes(i.tipo) ? i.tipo : 'OTRO',
            tipoPersonalizado: ['INJUSTIFICADA', 'CON_AVISO_INJUSTIFICADA', 'JUSTIFICADA_PAGA', 'JUSTIFICADA_NO_PAGA', 'TARDANZA'].includes(i.tipo) ? '' : i.tipo,
            motivo: i.motivo || '',
            tieneCertificado: i.tieneCertificado,
            observaciones: i.observaciones || '',
            minutosRetraso: i.minutosRetraso?.toString() || ''
        })
        setEditingId(i.id)
        setShowForm(true)
    }

    const handleDeleteInasistencia = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar este registro?')) return
        try {
            const res = await fetch(`/api/empleados/inasistencias/${id}`, { method: 'DELETE' })
            if (res.ok) fetchInasistencias()
        } catch (error) {
            console.error(error)
        }
    }

    const handleDetectarAusencias = async () => {
        const ayer = new Date()
        ayer.setDate(ayer.getDate() - 1)
        const fechaStr = ayer.toISOString().split('T')[0]
        
        if (!confirm(`¿Deseas detectar y registrar ausencias automáticamente para el día de ayer (${fechaStr})?`)) return
        
        setLoading(true)
        try {
            const res = await fetch('/api/empleados/inasistencias/detectar-ausencias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: fechaStr })
            })
            const data = await res.json()
            alert(data.mensaje || data.error)
            fetchInasistencias()
            fetchResumen()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }
    const handleSyncSemana = async () => {
        const hasta = new Date()
        hasta.setDate(hasta.getDate() - 1)
        const desde = new Date()
        desde.setDate(desde.getDate() - 7)
        
        const desdeStr = desde.toISOString().split('T')[0]
        const hastaStr = hasta.toISOString().split('T')[0]
        
        if (!confirm(`¿Deseas sincronizar y detectar ausencias de la última semana (${desdeStr} al ${hastaStr})? Esto regularizará el historial.`)) return
        
        setLoading(true)
        try {
            const res = await fetch('/api/empleados/inasistencias/detectar-ausencias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ desde: desdeStr, hasta: hastaStr })
            })
            const data = await res.json()
            alert(data.mensaje || data.error)
            fetchInasistencias()
            fetchResumen()
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
        tipoInasistencia: 'INJUSTIFICADA',
        limiteMaximo: 3,
        periodoDias: 30,
        accionSugerida: ''
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
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAlerta = async (id: string) => {
        if (!confirm('¿Seguro que quieres eliminar esta regla?')) return
        try {
            const res = await fetch(`/api/empleados/inasistencias/alertas/${id}`, { method: 'DELETE' })
            if (res.ok) fetchConfig()
        } catch (error) {
            console.error(error)
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
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-outline" onClick={handleDetectarAusencias} disabled={loading} title="Detectar ausencias de ayer">
                                        🔍 Ayer
                                    </button>
                                    <button className="btn btn-outline" onClick={handleSyncSemana} disabled={loading} title="Detectar ausencias de los últimos 7 días">
                                        🔄 Sincronizar Semana
                                    </button>
                                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                                        {showForm ? 'Cancelar' : '➕ Registrar Inasistencia'}
                                    </button>
                                </div>
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
                                                 <option value="TARDANZA">Tardanza</option>
                                                 <option value="OTRO">Otro (Personalizado...)</option>
                                             </select>
                                         </div>
                                         {newInasistencia.tipo === 'OTRO' && (
                                            <div className="form-group">
                                                <label className="form-label">Nombre del Motivo</label>
                                                <input 
                                                    type="text" 
                                                    className="form-input" 
                                                    value={newInasistencia.tipoPersonalizado}
                                                    onChange={e => setNewInasistencia({...newInasistencia, tipoPersonalizado: e.target.value.toUpperCase()})}
                                                    placeholder="Ej: SUSPENSION, FALTA_POR_PARO..."
                                                    required
                                                />
                                            </div>
                                         )}
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
                                        {newInasistencia.tieneCertificado && (
                                            <div className="form-group">
                                                <label className="form-label">Subir Certificado (PDF/Imagen)</label>
                                                <input 
                                                    type="file" 
                                                    className="form-input" 
                                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                                    accept="image/*,.pdf"
                                                />
                                            </div>
                                        )}
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
                                            <th>Acciones</th>
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
                                                <td style={{ textAlign: 'center' }}>
                                                    {i.tieneCertificado ? '✅' : '❌'}
                                                    {i.archivoUrl && (
                                                        <a href={i.archivoUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '4px', fontSize: '14px' }} title="Ver Documento">📄</a>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>{i.observaciones}</td>
                                                <td>
                                                     <div style={{ display: 'flex', gap: '5px' }}>
                                                         <button className="btn btn-outline btn-sm" onClick={() => handleEditInasistencia(i)}>✏️</button>
                                                         <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteInasistencia(i.id)}>🗑️</button>
                                                     </div>
                                                 </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'resumen' && (
                        <div className="resumen-container">
                            <div className="resumen-header">
                                <h3>Status de Ausentismo y Alertas Críticas</h3>
                                <p>Empleados que superaron umbrales de inasistencias en los periodos configurados.</p>
                            </div>
                            
                            <div className="resumen-grid">
                                {resumen.filter(r => r.alertasDisparadas.length > 0).map(r => (
                                    <div key={r.id} className="empleado-alert-card">
                                        <div className="card-header">
                                            <div className="emp-info">
                                                <div className="emp-avatar">{r.nombre.charAt(0)}</div>
                                                <h4>{r.nombre}</h4>
                                            </div>
                                            <span className="total-badge">Total: {r.inasistenciasTotales}</span>
                                        </div>
                                        
                                        <div className="alertas-list">
                                            {r.alertasDisparadas.map((a: any, idx: number) => {
                                                const isCritical = a.actual > a.limite;
                                                return (
                                                    <div key={idx} className={`alert-item ${isCritical ? 'critical' : 'warning'}`}>
                                                        <div className="alert-top">
                                                            <div className="alert-type">
                                                                <span className="icon">🚨</span>
                                                                <div className="type-label">
                                                                    <strong>{a.tipo.replace(/_/g, ' ')}</strong>
                                                                    <span>Últimos {a.periodoDias} días</span>
                                                                </div>
                                                            </div>
                                                            <div className="alert-ratio">
                                                                <span className="current">{a.actual}</span>
                                                                <span className="limit">/ {a.limite}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="alert-details">
                                                            <div className="detail-label">Fechas de los hechos:</div>
                                                            <div className="dates-row">
                                                                {a.detalles.map((d: any, didx: number) => (
                                                                    <div key={didx} className="date-tag" title={d.obs || 'Sin observaciones'}>
                                                                        {format(new Date(d.fecha), 'dd/MM')}
                                                                        {d.minutos && <span className="min-tag">-{d.minutos}m</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {a.accion && (
                                                            <div className="alert-action-suggestion">
                                                                <strong>Sugerencia:</strong> {a.accion}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        <div className="card-footer">
                                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                                setNewInasistencia({...newInasistencia, empleadoId: r.id})
                                                setActiveTab('lista')
                                            }}>Ver Historial Completo</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {resumen.filter(r => r.alertasDisparadas.length > 0).length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-icon">✅</div>
                                    <h4>Todo bajo control</h4>
                                    <p>No hay empleados que superen los límites de ausentismo configurados actualmente.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <h3>Configuración de Umbrales de Alerta</h3>
                                <button className="btn btn-primary btn-sm" onClick={() => {
                                    setEditingAlerta(null)
                                    setAlertaForm({
                                        tipoInasistencia: 'INJUSTIFICADA',
                                        limiteMaximo: 3,
                                        periodoDias: 30,
                                        accionSugerida: ''
                                    })
                                    setShowAlertaForm(true)
                                }}>➕ Nueva Regla</button>
                            </div>

                            {showAlertaForm && (
                                <form onSubmit={handleSaveAlerta} className="card shadow-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)' }}>
                                    <h4>{editingAlerta ? 'Editar Regla' : 'Nueva Regla de Alerta'}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginTop: '10px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Tipo de Inasistencia</label>
                                            <select 
                                                className="form-select" 
                                                value={alertaForm.tipoInasistencia}
                                                onChange={e => setAlertaForm({...alertaForm, tipoInasistencia: e.target.value})}
                                            >
                                                <option value="INJUSTIFICADA">Injustificada (Sin Aviso)</option>
                                                <option value="CON_AVISO_INJUSTIFICADA">Con Aviso - Injustificada</option>
                                                <option value="JUSTIFICADA_PAGA">Justificada (Paga)</option>
                                                <option value="JUSTIFICADA_NO_PAGA">Justificada (No Paga)</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Límite Máximo</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                value={alertaForm.limiteMaximo}
                                                onChange={e => setAlertaForm({...alertaForm, limiteMaximo: parseInt(e.target.value)})}
                                                min={1}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Periodo (Días)</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                value={alertaForm.periodoDias}
                                                onChange={e => setAlertaForm({...alertaForm, periodoDias: parseInt(e.target.value)})}
                                                min={1}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Acción Sugerida</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            value={alertaForm.accionSugerida}
                                            onChange={e => setAlertaForm({...alertaForm, accionSugerida: e.target.value})}
                                            placeholder="Ej: Sanción, Suspensión, Despido..."
                                        />
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button type="button" className="btn btn-outline" onClick={() => setShowAlertaForm(false)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Guardando...' : editingAlerta ? 'Actualizar Regla' : 'Crear Regla'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Tipo de Inasistencia</th>
                                            <th style={{ textAlign: 'center' }}>Límite Máximo</th>
                                            <th style={{ textAlign: 'center' }}>Periodo (Días)</th>
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
                                                <td><span className="badge badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)' }}>{a.accionSugerida}</span></td>
                                                <td style={{ display: 'flex', gap: '5px' }}>
                                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                                        setEditingAlerta(a)
                                                        setAlertaForm({
                                                            tipoInasistencia: a.tipoInasistencia,
                                                            limiteMaximo: a.limiteMaximo,
                                                            periodoDias: a.periodoDias,
                                                            accionSugerida: a.accionSugerida || ''
                                                        })
                                                        setShowAlertaForm(true)
                                                    }}>Editar</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteAlerta(a.id)}>Borrar</button>
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

                    /* Nuevos estilos premium */
                    .resumen-container {
                        padding: var(--space-2);
                    }
                    .resumen-header {
                        margin-bottom: var(--space-6);
                    }
                    .resumen-header h3 {
                        font-size: 1.5rem;
                        color: var(--color-gray-900);
                        margin: 0;
                    }
                    .resumen-header p {
                        color: var(--color-gray-500);
                        margin: var(--space-1) 0 0 0;
                    }

                    .resumen-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                        gap: var(--space-6);
                    }

                    .empleado-alert-card {
                        background: white;
                        border-radius: 16px;
                        border: 1px solid var(--color-gray-200);
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
                        overflow: hidden;
                        transition: transform 0.2s, box-shadow 0.2s;
                    }
                    .empleado-alert-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    }

                    .card-header {
                        padding: var(--space-4);
                        background: var(--color-gray-50);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--color-gray-100);
                    }
                    .emp-info {
                        display: flex;
                        align-items: center;
                        gap: var(--space-3);
                    }
                    .emp-avatar {
                        width: 32px;
                        height: 32px;
                        background: var(--color-primary);
                        color: white;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 0.8rem;
                    }
                    .emp-info h4 {
                        margin: 0;
                        font-size: 1.1rem;
                        font-weight: 700;
                    }
                    .total-badge {
                        font-size: 0.75rem;
                        padding: 2px 8px;
                        background: var(--color-gray-200);
                        border-radius: 12px;
                        color: var(--color-gray-700);
                        font-weight: 600;
                    }

                    .alertas-list {
                        padding: var(--space-4);
                        display: flex;
                        flex-direction: column;
                        gap: var(--space-4);
                    }
                    .alert-item {
                        padding: var(--space-4);
                        border-radius: 12px;
                        position: relative;
                        border: 1px solid transparent;
                    }
                    .alert-item.critical {
                        background: #FEF2F2;
                        border-color: #FEE2E2;
                    }
                    .alert-item.warning {
                        background: #FFFBEB;
                        border-color: #FEF3C7;
                    }

                    .alert-top {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: var(--space-3);
                    }
                    .alert-type {
                        display: flex;
                        gap: var(--space-2);
                    }
                    .type-label strong {
                        display: block;
                        font-size: 0.9rem;
                        color: #991B1B;
                        text-transform: uppercase;
                    }
                    .type-label span {
                        font-size: 0.75rem;
                        color: #B91C1C;
                        opacity: 0.7;
                    }
                    .alert-ratio {
                        text-align: right;
                    }
                    .alert-ratio .current {
                        font-size: 1.25rem;
                        font-weight: 800;
                        color: #991B1B;
                    }
                    .alert-ratio .limit {
                        font-size: 0.9rem;
                        color: #B91C1C;
                        opacity: 0.6;
                    }

                    .alert-details {
                        margin-top: var(--space-2);
                    }
                    .detail-label {
                        font-size: 0.7rem;
                        font-weight: 700;
                        color: #991B1B;
                        margin-bottom: 4px;
                        text-transform: uppercase;
                    }
                    .dates-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    .date-tag {
                        font-size: 0.75rem;
                        padding: 2px 6px;
                        background: white;
                        border: 1px solid rgba(153, 27, 27, 0.1);
                        border-radius: 4px;
                        color: #991B1B;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .min-tag {
                        background: #991B1B;
                        color: white;
                        padding: 0 3px;
                        border-radius: 2px;
                        font-size: 0.65rem;
                    }

                    .alert-action-suggestion {
                        margin-top: var(--space-3);
                        padding-top: var(--space-2);
                        border-top: 1px dashed rgba(153, 27, 27, 0.2);
                        font-size: 0.8rem;
                        color: #991B1B;
                    }

                    .card-footer {
                        padding: var(--space-3);
                        background: var(--color-gray-50);
                        text-align: center;
                    }

                    .empty-state {
                        text-align: center;
                        padding: 80px 20px;
                        background: white;
                        border-radius: 16px;
                        border: 2px dashed var(--color-gray-200);
                    }
                    .empty-icon {
                        font-size: 3rem;
                        margin-bottom: var(--space-4);
                    }
                    .empty-state h4 {
                        font-size: 1.25rem;
                        margin: 0;
                        color: var(--color-gray-900);
                    }
                    .empty-state p {
                        color: var(--color-gray-500);
                    }
                `}</style>
            </div>
        </div>
    )
}
