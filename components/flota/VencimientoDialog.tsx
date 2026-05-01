"use client"
import { useState } from 'react'

export function VencimientoDialog({ vencimiento, onSave, onClose }: { vencimiento?: any, onSave: any, onClose: any }) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(vencimiento?.kmVencimiento ? 'km' : 'fecha')
  const [formData, setFormData] = useState({
    tipo: vencimiento?.tipo || 'VTV',
    fechaVencimiento: vencimiento?.fechaVencimiento ? new Date(vencimiento.fechaVencimiento).toISOString().split('T')[0] : '',
    kmVencimiento: vencimiento?.kmVencimiento || '',
    kmAviso: vencimiento?.kmAviso || 2000,
    observaciones: vencimiento?.observaciones || '',
    diasAviso: vencimiento?.diasAviso || 30,
  })
  
  const [otroTipo, setOtroTipo] = useState(vencimiento && !['VTV','Seguro','Matafuego','Ruta','Service'].includes(vencimiento.tipo))

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleTipoChange = (e: any) => {
    const value = e.target.value;
    if (value === 'Otro') {
      setOtroTipo(true);
      setFormData({ ...formData, tipo: '' })
    } else {
      setOtroTipo(false);
      setFormData({ ...formData, tipo: value })
      if (value === 'Service') setMode('km')
      else if (['VTV','Seguro','Matafuego','Ruta'].includes(value)) setMode('fecha')
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    // Clean up data based on mode
    const submitData = { ...formData }
    if (mode === 'fecha') {
      submitData.kmVencimiento = null
      submitData.kmAviso = null
    } else {
      submitData.fechaVencimiento = null
      submitData.diasAviso = null
    }
    try { await onSave(submitData) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{vencimiento ? 'Editar Recordatorio' : 'Agregar Recordatorio'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Recordatorio</label>
              {!otroTipo ? (
                <select name="tipoSelect" value={formData.tipo} onChange={handleTipoChange} className="form-select">
                  <option value="VTV">VTV</option>
                  <option value="Seguro">Seguro</option>
                  <option value="Matafuego">Matafuego</option>
                  <option value="Ruta">Ruta</option>
                  <option value="Service">Service</option>
                  <option value="Otro">Otro...</option>
                </select>
              ) : (
                 <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                   <input required name="tipo" value={formData.tipo} onChange={handleChange} placeholder="Ej: RTO, Municipalidad" className="form-input" />
                   <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOtroTipo(false); setFormData({...formData, tipo: 'VTV'}) }}>Cancelar</button>
                 </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Configurar alerta por:</label>
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input type="radio" name="mode" value="fecha" checked={mode === 'fecha'} onChange={() => setMode('fecha')} />
                  Fecha de Vencimiento
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input type="radio" name="mode" value="km" checked={mode === 'km'} onChange={() => setMode('km')} />
                  Kilometraje (KMs)
                </label>
              </div>
            </div>

            {mode === 'fecha' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Fecha de Vencimiento</label>
                  <input required type="date" name="fechaVencimiento" value={formData.fechaVencimiento} onChange={handleChange} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Avisar (Días antes)</label>
                  <input required type="number" name="diasAviso" value={formData.diasAviso} onChange={handleChange} className="form-input" />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">KM del Evento</label>
                  <input required type="number" name="kmVencimiento" value={formData.kmVencimiento} onChange={handleChange} placeholder="Ej: 180000" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Avisar (KMs antes)</label>
                  <input required type="number" name="kmAviso" value={formData.kmAviso} onChange={handleChange} placeholder="Ej: 2000" className="form-input" />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Observaciones (Opcional)</label>
              <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} className="form-input" rows={2}></textarea>
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
