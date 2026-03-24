"use client"
import { useState } from 'react'

export function MantenimientoDialog({ mantenimiento, onSave, onClose }: { mantenimiento?: any, onSave: any, onClose: any }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    tipo: mantenimiento?.tipo || 'preventivo',
    fecha: mantenimiento?.fecha ? new Date(mantenimiento.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    taller: mantenimiento?.taller || '',
    costo: mantenimiento?.costo || '',
    descripcion: mantenimiento?.descripcion || '',
    kilometraje: mantenimiento?.kilometraje || '',
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
          <h2>{mantenimiento ? 'Editar Mantenimiento' : 'Registrar Mantenimiento'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Fecha del Servicio</label>
                <input required type="date" name="fecha" value={formData.fecha} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select name="tipo" value={formData.tipo} onChange={handleChange} className="form-select">
                  <option value="preventivo">Preventivo (Programado)</option>
                  <option value="correctivo">Correctivo (Rotura)</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Detalle del Arreglo / Servicio</label>
              <textarea required name="descripcion" value={formData.descripcion} onChange={handleChange} className="form-input" rows={2} placeholder="Ej: Cambio de aceite, Reparación de frenos..."></textarea>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Taller / Proveedor (Opcional)</label>
                <input type="text" name="taller" value={formData.taller} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Costo ($)</label>
                <input required type="number" step="0.01" name="costo" value={formData.costo} onChange={handleChange} className="form-input" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Kilometraje al momento del servicio (Opcional)</label>
              <input type="number" name="kilometraje" value={formData.kilometraje} onChange={handleChange} className="form-input" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
