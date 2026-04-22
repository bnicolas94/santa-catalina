'use client'

import { useState, useEffect } from 'react'
import NuevaEvaluacionModal from './NuevaEvaluacionModal'

interface Evaluacion {
    id: string
    fecha: string
    calificacion: string
    puntosFuertes: string
    puntosMejora: string
    comentarios: string
    evaluador: { nombre: string, apellido: string }
}

export default function EvaluacionesTab({ empleadoId }: { empleadoId: string }) {
    const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
    const [loading, setLoading] = useState(true)
    const [showNuevaModal, setShowNuevaModal] = useState(false)

    const fetchEvaluaciones = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/evaluaciones?empleadoId=${empleadoId}`)
            if (res.ok) {
                const data = await res.json()
                setEvaluaciones(data)
            }
        } catch (error) {
            console.error('Error fetching evaluaciones:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvaluaciones()
    }, [empleadoId])

    const getCalificacionColor = (calif: string) => {
        switch (calif.toLowerCase()) {
            case 'excelente': return 'var(--color-success)'
            case 'bueno': return '#3b82f6'
            case 'regular': return 'var(--color-warning)'
            case 'malo': return 'var(--color-danger)'
            default: return 'var(--color-gray-500)'
        }
    }

    return (
        <div className="evaluaciones-tab" style={{ padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Historial de Desempeño</h3>
                <button 
                    type="button"
                    className="btn btn-primary btn-sm" 
                    onClick={() => setShowNuevaModal(true)}
                >
                    + Nueva Evaluación
                </button>
            </div>

            {loading ? (
                <p>Cargando evaluaciones...</p>
            ) : evaluaciones.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)', border: '2px dashed var(--color-gray-200)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ fontSize: '2rem' }}>⭐</p>
                    <p>No hay evaluaciones registradas para este empleado.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {evaluaciones.map((eva) => (
                        <div key={eva.id} className="card shadow-sm" style={{ padding: 'var(--space-4)', borderLeft: `5px solid ${getCalificacionColor(eva.calificacion)}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                                    Evaluación del {new Date(eva.fecha).toLocaleDateString()}
                                </div>
                                <div className="badge" style={{ backgroundColor: getCalificacionColor(eva.calificacion), color: 'white' }}>
                                    {eva.calificacion}
                                </div>
                            </div>
                            
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)' }}>
                                Evaluador: {eva.evaluador.nombre} {eva.evaluador.apellido}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                <div>
                                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-success)' }}>Puntos Fuertes</div>
                                    <div style={{ fontSize: 'var(--text-sm)' }}>{eva.puntosFuertes || 'No especificado'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-warning)' }}>Puntos de Mejora</div>
                                    <div style={{ fontSize: 'var(--text-sm)' }}>{eva.puntosMejora || 'No especificado'}</div>
                                </div>
                            </div>

                            {eva.comentarios && (
                                <div style={{ borderTop: '1px solid var(--color-gray-100)', paddingTop: 'var(--space-2)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-gray-400)' }}>Comentarios Generales</div>
                                    <div style={{ fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>"{eva.comentarios}"</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showNuevaModal && (
                <NuevaEvaluacionModal 
                    empleadoId={empleadoId} 
                    onClose={() => setShowNuevaModal(false)} 
                    onSuccess={() => {
                        setShowNuevaModal(false)
                        fetchEvaluaciones()
                    }}
                />
            )}
        </div>
    )
}
