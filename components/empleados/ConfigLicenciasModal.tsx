'use client'

import { useState, useEffect } from 'react'

interface TipoLicencia {
    id: string
    nombre: string
    descripcion: string | null
    conGoceSueldo: boolean
    activo: boolean
}

interface ConfigLicenciasModalProps {
    onClose: () => void
}

export function ConfigLicenciasModal({ onClose }: ConfigLicenciasModalProps) {
    const [licencias, setLicencias] = useState<TipoLicencia[]>([])
    const [loading, setLoading] = useState(false)
    
    // Estado para el formulario de crear/editar
    const [formData, setFormData] = useState<Partial<TipoLicencia>>({
        nombre: '',
        descripcion: '',
        conGoceSueldo: false,
        activo: true
    })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const fetchLicencias = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/licencias')
            const data = await res.json()
            setLicencias(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLicencias()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.nombre) return

        setSaving(true)
        try {
            const url = editingId ? `/api/licencias?id=${editingId}` : '/api/licencias'
            const method = editingId ? 'PUT' : 'POST'
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                setEditingId(null)
                setFormData({ nombre: '', descripcion: '', conGoceSueldo: false, activo: true })
                fetchLicencias()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al guardar')
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión')
        } finally {
            setSaving(false)
        }
    }

    const startEdit = (lic: TipoLicencia) => {
        setEditingId(lic.id)
        setFormData({
            nombre: lic.nombre,
            descripcion: lic.descripcion || '',
            conGoceSueldo: lic.conGoceSueldo,
            activo: lic.activo
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setFormData({ nombre: '', descripcion: '', conGoceSueldo: false, activo: true })
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar este tipo de licencia? Si ya fue utilizada en una inasistencia, dará error.')) return
        
        try {
            const res = await fetch(`/api/licencias?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchLicencias()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al eliminar')
            }
        } catch (err) {
            console.error(err)
            alert('Error de conexión')
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
                <div className="modal-header">
                    <h2>⚙️ Configurar Tipos de Licencia</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    
                    {/* Formulario de Carga / Edición */}
                    <div className="card" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>
                            {editingId ? 'Editar Licencia' : 'Nueva Licencia'}
                        </h3>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Nombre del Motivo *</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Ej: Vacaciones, Enfermedad, Maternidad..."
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción (Opcional)</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={formData.descripcion || ''}
                                    onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.conGoceSueldo || false} 
                                        onChange={e => setFormData({ ...formData, conGoceSueldo: e.target.checked })}
                                    />
                                    <strong>Con Goce de Sueldo</strong>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={formData.activo ?? true} 
                                        onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                                    />
                                    <strong>Activo (Visible en listas)</strong>
                                </label>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                                {editingId && (
                                    <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancelar</button>
                                )}
                                <button type="submit" className="btn btn-primary" disabled={saving || !formData.nombre}>
                                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Agregar'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Tabla de Registros */}
                    <div>
                        <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)' }}>Licencias Registradas</h3>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-gray-500)' }}>Cargando...</div>
                        ) : licencias.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--color-gray-500)' }}>
                                No hay licencias configuradas.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Goce Sueldo</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {licencias.map((lic) => (
                                            <tr key={lic.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{lic.nombre}</div>
                                                    {lic.descripcion && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{lic.descripcion}</div>}
                                                </td>
                                                <td>
                                                    {lic.conGoceSueldo 
                                                        ? <span className="badge badge-success">Sí (Remunerada)</span> 
                                                        : <span className="badge badge-danger">No (Se descuenta)</span>
                                                    }
                                                </td>
                                                <td>
                                                    <span className={`badge ${lic.activo ? 'badge-info' : 'badge-ghost'}`}>
                                                        {lic.activo ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => startEdit(lic)} title="Editar">✏️</button>
                                                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDelete(lic.id)} title="Eliminar">🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}
