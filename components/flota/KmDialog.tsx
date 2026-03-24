"use client"
import { useState } from 'react'

export function KmDialog({ kmActual, onSave, onClose }: { kmActual: number, onSave: any, onClose: any }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    kmRegistrado: kmActual || 0,
    observaciones: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    try { await onSave(formData) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Registrar Kilometraje</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ backgroundColor: 'var(--color-info-bg)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: 'var(--text-sm)' }}><strong>KM Actual Registrado:</strong> {kmActual} km</p>
            </div>
            <div className="form-group">
              <label className="form-label">Nuevo Kilometraje</label>
              <input required type="number" name="kmRegistrado" value={formData.kmRegistrado} onChange={handleChange} min={kmActual} className="form-input" />
              <small style={{ color: 'var(--color-gray-500)' }}>Debe ser mayor o igual al KM actual.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input required type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones (Opcional)</label>
              <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} className="form-input" rows={3}></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Guardando...' : 'Guardar KM'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
