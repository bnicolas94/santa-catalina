'use client'

import { useState, useEffect } from 'react'

interface Documento {
    id: string
    empleadoId: string
    tipoDocumento: string
    archivoUrl: string
    fechaVencimiento: string | null
    observaciones: string | null
    createdAt: string
}

export default function DocumentosTab({ empleadoId }: { empleadoId: string }) {
    const [documentos, setDocumentos] = useState<Documento[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [formData, setFormData] = useState({
        tipoDocumento: 'DNI',
        fechaVencimiento: '',
        observaciones: ''
    })

    const fetchDocumentos = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/documentos-empleado?empleadoId=${empleadoId}`)
            if (res.ok) {
                const data = await res.json()
                setDocumentos(data)
            }
        } catch (error) {
            console.error('Error fetching documentos:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocumentos()
    }, [empleadoId])

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            alert('Por favor selecciona un archivo')
            return
        }

        setUploading(true)
        try {
            const data = new FormData()
            data.append('empleadoId', empleadoId)
            data.append('tipoDocumento', formData.tipoDocumento)
            data.append('file', file)
            if (formData.fechaVencimiento) data.append('fechaVencimiento', formData.fechaVencimiento)
            if (formData.observaciones) data.append('observaciones', formData.observaciones)

            const res = await fetch('/api/documentos-empleado', {
                method: 'POST',
                body: data
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al subir el documento')
            }

            setFile(null)
            setFormData({ tipoDocumento: 'DNI', fechaVencimiento: '', observaciones: '' })
            fetchDocumentos()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de querer eliminar este documento?')) return

        try {
            const res = await fetch(`/api/documentos-empleado?id=${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Error al eliminar')
            fetchDocumentos()
        } catch (error: any) {
            alert(error.message)
        }
    }

    return (
        <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
            <div style={{ flex: 2 }}>
                <h3 style={{ marginBottom: 'var(--space-3)' }}>Documentos del Legajo</h3>
                
                {loading ? (
                    <p style={{ color: 'var(--color-gray-500)' }}>Cargando documentos...</p>
                ) : documentos.length === 0 ? (
                    <div style={{ padding: 'var(--space-8)', textAlign: 'center', border: '2px dashed var(--color-gray-300)', borderRadius: 'var(--radius-md)', color: 'var(--color-gray-500)' }}>
                        No hay documentos subidos para este empleado.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-3)' }}>
                        {documentos.map(doc => {
                            const isExpired = doc.fechaVencimiento && new Date(doc.fechaVencimiento) < new Date()
                            return (
                                <div key={doc.id} style={{ 
                                    border: '1px solid var(--color-gray-200)', 
                                    borderRadius: 'var(--radius-md)', 
                                    padding: 'var(--space-3)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-2)',
                                    backgroundColor: isExpired ? '#FEF2F2' : 'white',
                                    borderColor: isExpired ? '#FCA5A5' : 'var(--color-gray-200)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span className="badge badge-info">{doc.tipoDocumento}</span>
                                        <button onClick={() => handleDelete(doc.id)} className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--color-danger)' }}>
                                            ✕
                                        </button>
                                    </div>
                                    
                                    {doc.observaciones && <p style={{ fontSize: 'var(--text-xs)', margin: 0, color: 'var(--color-gray-600)' }}>{doc.observaciones}</p>}
                                    
                                    {doc.fechaVencimiento && (
                                        <div style={{ fontSize: 'var(--text-xs)', color: isExpired ? 'var(--color-danger)' : 'var(--color-gray-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {isExpired ? '⚠️ Vencido:' : '⏳ Vence:'} {new Date(doc.fechaVencimiento).toLocaleDateString()}
                                        </div>
                                    )}
                                    
                                    <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
                                        <a href={doc.archivoUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                                            👁️ Ver Documento
                                        </a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', height: 'fit-content' }}>
                <h3 style={{ marginBottom: 'var(--space-4)' }}>Subir Nuevo</h3>
                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div className="form-group">
                        <label className="form-label">Tipo de Documento</label>
                        <select 
                            className="form-select" 
                            value={formData.tipoDocumento}
                            onChange={e => setFormData({...formData, tipoDocumento: e.target.value})}
                        >
                            <option value="DNI">DNI (Frente y Dorso)</option>
                            <option value="ALTA_AFIP">Alta AFIP</option>
                            <option value="CERTIFICADO_MEDICO">Certificado Médico</option>
                            <option value="CONTRATO">Contrato</option>
                            <option value="RECIBO_FIRMADO">Recibo Firmado</option>
                            <option value="OTRO">Otro</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Archivo</label>
                        <input 
                            type="file" 
                            className="form-input" 
                            required 
                            onChange={e => setFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Fecha de Vencimiento (Opcional)</label>
                        <input 
                            type="date" 
                            className="form-input" 
                            value={formData.fechaVencimiento}
                            onChange={e => setFormData({...formData, fechaVencimiento: e.target.value})}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Observaciones</label>
                        <textarea 
                            className="form-input" 
                            rows={2}
                            value={formData.observaciones}
                            onChange={e => setFormData({...formData, observaciones: e.target.value})}
                            placeholder="Ej: Solo frente"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                        {uploading ? 'Subiendo...' : 'Subir Documento'}
                    </button>
                </form>
            </div>
        </div>
    )
}
