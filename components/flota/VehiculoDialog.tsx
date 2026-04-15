"use client"
import { useState } from 'react'

export function VehiculoDialog({ vehiculo, onSave, onClose }: { vehiculo?: any, onSave: any, onClose: any }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    patente: vehiculo?.patente || '',
    alias: vehiculo?.alias || '',
    marca: vehiculo?.marca || '',
    modelo: vehiculo?.modelo || '',
    anio: vehiculo?.anio || new Date().getFullYear(),
    kmActual: vehiculo?.kmActual || 0,
    estado: vehiculo?.estado || 'disponible',
    kmProximoService: vehiculo?.kmProximoService || '',
    avisoKmsAntes: vehiculo?.avisoKmsAntes || 2000,
    activo: vehiculo?.activo !== undefined ? vehiculo.activo : true,
  })

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    try { await onSave(formData) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{vehiculo ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Patente</label>
                <input required name="patente" value={formData.patente} onChange={handleChange} className="form-input" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Alias (Ej: Kangoo Blanca)</label>
                <input name="alias" value={formData.alias} onChange={handleChange} className="form-input" placeholder="Opcional" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Marca</label>
                <input required name="marca" value={formData.marca} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input required name="modelo" value={formData.modelo} onChange={handleChange} className="form-input" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Año</label>
                <input required type="number" name="anio" value={formData.anio} onChange={handleChange} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Kilometraje Inicial/Actual</label>
                <input required type="number" name="kmActual" value={formData.kmActual} onChange={handleChange} className="form-input" disabled={!!vehiculo} title={vehiculo ? "Actualizar mediante carga de nuevo Kilometraje" : ""} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select name="estado" value={formData.estado} onChange={handleChange} className="form-select">
                <option value="disponible">Disponible</option>
                <option value="taller">En Taller</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <h3 style={{ marginTop: 'var(--space-2)', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>⚙️ Configuración de Alertas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Próximo Service (KM)</label>
                <input type="number" name="kmProximoService" value={formData.kmProximoService} onChange={handleChange} className="form-input" placeholder="Ej: 80000" />
              </div>
              <div className="form-group">
                <label className="form-label">Avisar ___ KM antes</label>
                <input required type="number" name="avisoKmsAntes" value={formData.avisoKmsAntes} onChange={handleChange} className="form-input" />
              </div>
            </div>

            {vehiculo && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} />
                <label>Vehículo Activo</label>
              </div>
            )}
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
