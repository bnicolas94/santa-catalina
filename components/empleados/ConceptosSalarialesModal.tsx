'use client'

import { useState, useEffect } from 'react'

interface Concepto {
    id: string
    nombre: string
    tipo: 'REMUNERATIVO' | 'NO_REMUNERATIVO' | 'DESCUENTO'
    esPorcentaje: boolean
    valorPorDefecto: number | null
    activo: boolean
}

export default function ConceptosSalarialesModal({ onClose }: { onClose: () => void }) {
    const [conceptos, setConceptos] = useState<Concepto[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        nombre: '',
        tipo: 'REMUNERATIVO',
        esPorcentaje: false,
        valorPorDefecto: ''
    })

    const fetchConceptos = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/conceptos-salariales')
            if (res.ok) {
                const data = await res.json()
                setConceptos(data)
            }
        } catch (error) {
            console.error('Error fetching conceptos:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchConceptos()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const isEdit = !!editingId
            const method = isEdit ? 'PUT' : 'POST'
            
            const payload = {
                id: editingId,
                nombre: formData.nombre,
                tipo: formData.tipo,
                esPorcentaje: formData.esPorcentaje,
                valorPorDefecto: formData.valorPorDefecto ? parseFloat(formData.valorPorDefecto) : null
            }

            const res = await fetch('/api/conceptos-salariales', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar el concepto')
            }

            setFormData({ nombre: '', tipo: 'REMUNERATIVO', esPorcentaje: false, valorPorDefecto: '' })
            setEditingId(null)
            fetchConceptos()
        } catch (error: any) {
            alert(error.message)
        }
    }

    const handleEdit = (c: Concepto) => {
        setEditingId(c.id)
        setFormData({
            nombre: c.nombre,
            tipo: c.tipo,
            esPorcentaje: c.esPorcentaje,
            valorPorDefecto: c.valorPorDefecto?.toString() || ''
        })
    }

    const handleToggleActive = async (c: Concepto) => {
        if (!confirm(`¿Estás seguro de querer ${c.activo ? 'desactivar' : 'activar'} este concepto?`)) return
        
        try {
            const method = c.activo ? 'DELETE' : 'PUT'
            const url = c.activo ? `/api/conceptos-salariales?id=${c.id}` : '/api/conceptos-salariales'
            const body = c.activo ? null : JSON.stringify({ id: c.id, activo: true })

            const res = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body || undefined
            })

            if (!res.ok) throw new Error('Error al cambiar el estado')
            
            fetchConceptos()
        } catch (error: any) {
            alert(error.message)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%' }}>
                <div className="modal-header">
                    <h2>🏷️ Configuración de Conceptos Salariales</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', gap: 'var(--space-6)', maxHeight: '70vh', overflowY: 'auto' }}>
                    {/* Lista */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: 'var(--space-3)' }}>Conceptos Existentes</h3>
                        {loading ? (
                            <p style={{ color: 'var(--color-gray-500)' }}>Cargando conceptos...</p>
                        ) : conceptos.length === 0 ? (
                            <p style={{ color: 'var(--color-gray-500)' }}>No hay conceptos configurados.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {conceptos.map(c => (
                                    <div key={c.id} style={{
                                        padding: 'var(--space-3)',
                                        border: '1px solid var(--color-gray-200)',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: c.activo ? 'white' : 'var(--color-gray-50)',
                                        opacity: c.activo ? 1 : 0.6,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 'var(--space-2)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <h4 style={{ margin: 0, fontWeight: 600 }}>{c.nombre}</h4>
                                                    <span className={`badge ${
                                                        c.tipo === 'REMUNERATIVO' ? 'badge-success' : 
                                                        c.tipo === 'DESCUENTO' ? 'badge-danger' : 
                                                        'badge-warning'
                                                    }`} style={{ fontSize: '10px' }}>
                                                        {c.tipo}
                                                    </span>
                                                </div>
                                                <div style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)' }}>
                                                    {c.esPorcentaje ? 'Valor: Porcentaje' : 'Valor: Monto Fijo'}
                                                    {c.valorPorDefecto !== null && (
                                                        <span> (Defecto: {c.esPorcentaje ? `${c.valorPorDefecto}%` : `$${c.valorPorDefecto}`})</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                                <button 
                                                    className="btn btn-ghost btn-sm btn-icon" 
                                                    onClick={() => handleEdit(c)}
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className="btn btn-ghost btn-sm btn-icon" 
                                                    onClick={() => handleToggleActive(c)}
                                                    title={c.activo ? "Desactivar" : "Activar"}
                                                >
                                                    {c.activo ? '❌' : '✅'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Formulario */}
                    <div style={{ width: '300px', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', height: 'fit-content' }}>
                        <h3 style={{ marginBottom: 'var(--space-4)' }}>{editingId ? 'Editar Concepto' : 'Nuevo Concepto'}</h3>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">Nombre del Concepto</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    required 
                                    placeholder="Ej: Premio Asistencia" 
                                    value={formData.nombre}
                                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Tipo de Concepto</label>
                                <select 
                                    className="form-select" 
                                    value={formData.tipo}
                                    onChange={e => setFormData({...formData, tipo: e.target.value as any})}
                                >
                                    <option value="REMUNERATIVO">Suma Remunerativa (+)</option>
                                    <option value="NO_REMUNERATIVO">Suma No Remunerativa (+)</option>
                                    <option value="DESCUENTO">Descuento (-)</option>
                                </select>
                            </div>
                            
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <input 
                                    type="checkbox" 
                                    id="esPorcentaje"
                                    checked={formData.esPorcentaje}
                                    onChange={e => setFormData({...formData, esPorcentaje: e.target.checked})}
                                />
                                <label htmlFor="esPorcentaje" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                                    Es Porcentaje (sobre sueldo base)
                                </label>
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Valor por Defecto (Opcional)</label>
                                <div style={{ display: 'flex' }}>
                                    <span style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-100)', border: '1px solid var(--color-gray-300)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', color: 'var(--color-gray-500)' }}>
                                        {formData.esPorcentaje ? '%' : '$'}
                                    </span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        className="form-input" 
                                        placeholder="0.00" 
                                        style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                                        value={formData.valorPorDefecto}
                                        onChange={e => setFormData({...formData, valorPorDefecto: e.target.value})}
                                    />
                                </div>
                                <small style={{ color: 'var(--color-gray-500)', marginTop: '2px', display: 'block' }}>
                                    Se pre-completará en la liquidación.
                                </small>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                                {editingId && (
                                    <button 
                                        type="button" 
                                        className="btn btn-ghost" 
                                        onClick={() => {
                                            setEditingId(null);
                                            setFormData({ nombre: '', tipo: 'REMUNERATIVO', esPorcentaje: false, valorPorDefecto: '' });
                                        }}
                                        style={{ flex: 1 }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                                    {editingId ? 'Actualizar' : 'Crear Concepto'}
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
