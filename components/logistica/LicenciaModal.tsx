"use client"

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface LicenciaModalProps {
    chofer: any
    onClose: () => void
    onSuccess: () => void
}

export default function LicenciaModal({ chofer, onClose, onSuccess }: LicenciaModalProps) {
    const [loading, setLoading] = useState(false)
    const [fechaVencimiento, setFechaVencimiento] = useState(
        chofer.documentos?.[0]?.fechaVencimiento 
            ? new Date(chofer.documentos[0].fechaVencimiento).toISOString().split('T')[0] 
            : ''
    )
    const [file, setFile] = useState<File | null>(null)
    const [diasAviso, setDiasAviso] = useState(chofer.documentos?.[0]?.diasAviso?.toString() || '30')
    const [observaciones, setObservaciones] = useState(chofer.documentos?.[0]?.observaciones || '')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file && !chofer.documentos?.[0]) {
            toast.error('Debes subir el archivo del carnet')
            return
        }

        setLoading(true)
        try {
            const formData = new FormData()
            formData.append('empleadoId', chofer.id)
            formData.append('tipoDocumento', 'LICENCIA_CONDUCIR')
            if (fechaVencimiento) formData.append('fechaVencimiento', fechaVencimiento)
            if (diasAviso) formData.append('diasAviso', diasAviso)
            if (observaciones) formData.append('observaciones', observaciones)
            if (file) formData.append('file', file)

            const res = await fetch('/api/documentos-empleado', {
                method: 'POST',
                body: formData
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al subir documento')
            }

            toast.success('Licencia actualizada correctamente')
            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error uploading license:', error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>Actualizar Licencia: {chofer.nombre} {chofer.apellido}</h2>
                    <button onClick={onClose} className="btn btn-ghost">✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            <div className="form-group">
                                <label className="form-label">Fecha de Vencimiento</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={fechaVencimiento} 
                                    onChange={e => setFechaVencimiento(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Días de Aviso</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={diasAviso} 
                                    onChange={e => setDiasAviso(e.target.value)} 
                                    placeholder="Ej: 30"
                                    required 
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Archivo del Carnet (Imagen o PDF)</label>
                            <input 
                                type="file" 
                                className="form-input" 
                                onChange={e => setFile(e.target.files?.[0] || null)} 
                                accept="image/*,.pdf"
                                required={!chofer.documentos?.[0]}
                            />
                            {chofer.documentos?.[0] && (
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                    Ya existe un archivo cargado. Subí uno nuevo para reemplazarlo.
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Observaciones</label>
                            <textarea 
                                className="form-input" 
                                value={observaciones} 
                                onChange={e => setObservaciones(e.target.value)} 
                                placeholder="Ej: Categoría E1, requiere anteojos..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
