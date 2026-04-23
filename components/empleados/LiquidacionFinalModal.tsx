'use client'

import { useState } from 'react'

interface LiquidacionFinalModalProps {
    empleado: any
    onClose: () => void
    onSuccess: () => void
}

export default function LiquidacionFinalModal({ empleado, onClose, onSuccess }: LiquidacionFinalModalProps) {
    const [fechaEgreso, setFechaEgreso] = useState(new Date().toISOString().split('T')[0])
    const [causaEgreso, setCausaEgreso] = useState('RENUNCIA')
    const [omitirPreaviso, setOmitirPreaviso] = useState(false)
    const [preview, setPreview] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [confirming, setConfirming] = useState(false)

    const handlePreview = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/liquidaciones/final', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPreview: true,
                    empleadoId: empleado.id,
                    fechaEgreso,
                    causaEgreso,
                    omitirPreaviso
                })
            })
            const data = await res.json()
            if (res.ok) {
                setPreview(data)
            } else {
                alert(data.error)
            }
        } catch (error) {
            alert('Error al calcular preview')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async () => {
        if (!confirm('¿Estás seguro? Esta acción dará de baja al empleado y generará la liquidación final.')) return
        
        setConfirming(true)
        try {
            const res = await fetch('/api/liquidaciones/final', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPreview: false,
                    empleadoId: empleado.id,
                    fechaEgreso,
                    causaEgreso,
                    omitirPreaviso
                })
            })
            if (res.ok) {
                onSuccess()
            } else {
                const data = await res.json()
                alert(data.error)
            }
        } catch (error) {
            alert('Error al confirmar egreso')
        } finally {
            setConfirming(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <h2>⚖️ Liquidación Final LCT</h2>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                        Calculando egreso para {empleado.nombre} {empleado.apellido}
                    </p>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Fecha de Egreso</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={fechaEgreso} 
                                onChange={e => { setFechaEgreso(e.target.value); setPreview(null); }} 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Causa de Egreso</label>
                            <select 
                                className="form-select" 
                                value={causaEgreso} 
                                onChange={e => { setCausaEgreso(e.target.value); setPreview(null); }}
                            >
                                <option value="RENUNCIA">Renuncia</option>
                                <option value="DESPIDO_SIN_CAUSA">Despido Sin Causa</option>
                                <option value="DESPIDO_CON_CAUSA">Despido Con Causa</option>
                                <option value="FIN_CONTRATO">Fin de Contrato</option>
                            </select>
                        </div>
                    </div>

                    {causaEgreso === 'DESPIDO_SIN_CAUSA' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={omitirPreaviso} 
                                onChange={e => { setOmitirPreaviso(e.target.checked); setPreview(null); }} 
                            />
                            <span style={{ fontSize: 'var(--text-sm)' }}>Falta de Preaviso (Indemnización Sustitutiva)</span>
                        </label>
                    )}

                    <button 
                        type="button" 
                        className="btn btn-outline" 
                        onClick={handlePreview} 
                        disabled={loading}
                    >
                        {loading ? 'Calculando...' : '🧮 Calcular Liquidación'}
                    </button>

                    {preview && (
                        <div className="card shadow-sm" style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-gray-200)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                <span style={{ fontWeight: 700 }}>Resumen del Cálculo</span>
                                <span className="badge badge-info">Antigüedad: {preview.antiguedad}</span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {preview.items.map((item: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                                        <span style={{ color: 'var(--color-gray-600)' }}>{item.nombre}</span>
                                        <span style={{ fontWeight: 600 }}>${item.monto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)', paddingTop: 'var(--space-2)', borderTop: '2px solid var(--color-gray-300)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
                                <span>TOTAL NETO A PAGAR</span>
                                <span style={{ color: 'var(--color-primary)' }}>${preview.totalNeto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
                    <button 
                        type="button" 
                        className="btn btn-primary" 
                        disabled={!preview || confirming} 
                        onClick={handleConfirm}
                        style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    >
                        {confirming ? 'Procesando...' : '⚠️ Confirmar Egreso y Baja'}
                    </button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
