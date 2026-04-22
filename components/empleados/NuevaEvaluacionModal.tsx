'use client'

import { useState } from 'react'

interface NuevaEvaluacionModalProps {
    empleadoId: string
    onClose: () => void
    onSuccess: () => void
}

export default function NuevaEvaluacionModal({ empleadoId, onClose, onSuccess }: NuevaEvaluacionModalProps) {
    const [calificacion, setCalificacion] = useState('Bueno')
    const [puntosFuertes, setPuntosFuertes] = useState('')
    const [puntosMejora, setPuntosMejora] = useState('')
    const [comentarios, setComentarios] = useState('')
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
    const [guardando, setGuardando] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setGuardando(true)

        try {
            const res = await fetch('/api/evaluaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId,
                    calificacion,
                    puntosFuertes,
                    puntosMejora,
                    comentarios,
                    fecha
                })
            })

            if (res.ok) {
                onSuccess()
            } else {
                const data = await res.json()
                alert(data.error || 'Error al guardar la evaluación')
            }
        } catch (error) {
            console.error('Error saving evaluacion:', error)
            alert('Error en la conexión')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
                <div className="modal-header">
                    <h2>⭐ Nueva Evaluación de Desempeño</h2>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Fecha de Evaluación</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={fecha} 
                                onChange={e => setFecha(e.target.value)} 
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Calificación General</label>
                            <select 
                                className="form-select" 
                                value={calificacion} 
                                onChange={e => setCalificacion(e.target.value)}
                                required
                            >
                                <option value="Excelente">🌟 Excelente</option>
                                <option value="Bueno">✅ Bueno</option>
                                <option value="Regular">⚠️ Regular</option>
                                <option value="Malo">❌ Malo</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Puntos Fuertes</label>
                            <textarea 
                                className="form-input" 
                                style={{ minHeight: '80px' }}
                                value={puntosFuertes} 
                                onChange={e => setPuntosFuertes(e.target.value)}
                                placeholder="¿Qué hizo bien? Habilidades destacadas..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Puntos de Mejora</label>
                            <textarea 
                                className="form-input" 
                                style={{ minHeight: '80px' }}
                                value={puntosMejora} 
                                onChange={e => setPuntosMejora(e.target.value)}
                                placeholder="¿Qué puede mejorar? Objetivos para el próximo periodo..."
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Comentarios Adicionales</label>
                            <textarea 
                                className="form-input" 
                                style={{ minHeight: '60px' }}
                                value={comentarios} 
                                onChange={e => setComentarios(e.target.value)}
                                placeholder="Notas adicionales del evaluador..."
                            />
                        </div>
                    </div>

                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar Evaluación'}
                        </button>
                    </div>
                </form>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
