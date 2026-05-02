"use client"

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface VacacionesSACModalProps {
    onClose: () => void
    empleados: any[]
}

export function VacacionesSACModal({ onClose, empleados }: VacacionesSACModalProps) {
    const [tab, setTab] = useState<'sac' | 'vacaciones'>('sac')
    const [selectedEmpleado, setSelectedEmpleado] = useState('')
    const [anio, setAnio] = useState(new Date().getFullYear())
    const [semestre, setSemestre] = useState<1 | 2>(new Date().getMonth() < 6 ? 1 : 2)
    const [cajaId, setCajaId] = useState('caja_chica')
    const [loading, setLoading] = useState(false)
    const [previewData, setPreviewData] = useState<any>(null)
    const [montoManual, setMontoManual] = useState<number | null>(null)
    const [diasManual, setDiasManual] = useState<number>(0)
    const [fechaInicioGoce, setFechaInicioGoce] = useState('')
    const [fechaFinGoce, setFechaFinGoce] = useState('')

    useEffect(() => {
        if (selectedEmpleado) {
            handlePreview()
        }
    }, [selectedEmpleado, anio, semestre, tab])

    const handlePreview = async () => {
        setLoading(true)
        setPreviewData(null)
        setMontoManual(null)
        try {
            const url = tab === 'sac' 
                ? `/api/liquidaciones/sac?empleadoId=${selectedEmpleado}&anio=${anio}&semestre=${semestre}`
                : `/api/liquidaciones/vacaciones?empleadoId=${selectedEmpleado}&anio=${anio}`
            
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                if (data.error) {
                    toast.error(data.error)
                    return
                }
                setPreviewData(data)
                setMontoManual(tab === 'sac' ? data.sac : data.monto)
                setDiasManual(tab === 'sac' ? 180 : data.dias)
            }
        } catch (error) {
            console.error('Error previewing:', error)
            toast.error('Error al calcular previsualización')
        } finally {
            setLoading(false)
        }
    }

    const handleLiquidar = async () => {
        if (!selectedEmpleado || !montoManual) return
        setLoading(true)
        try {
            const url = tab === 'sac' ? '/api/liquidaciones/sac' : '/api/liquidaciones/vacaciones'
            const body = tab === 'sac' 
                ? { empleadoId: selectedEmpleado, anio, semestre, monto: montoManual, cajaId }
                : { 
                    empleadoId: selectedEmpleado, 
                    anio, 
                    monto: montoManual, 
                    dias: diasManual, 
                    cajaId,
                    fechaInicioGoce,
                    fechaFinGoce
                  }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                toast.success(`${tab.toUpperCase()} liquidado correctamente`)
                onClose()
            } else {
                const err = await res.json()
                toast.error(err.error || 'Error al liquidar')
            }
        } catch (error) {
            toast.error('Error de red')
        } finally {
            setLoading(false)
        }
    }

    const handleDiasManualChange = (val: number) => {
        setDiasManual(val);
        if (previewData && previewData.dias > 0) {
            const valorDia = previewData.monto / previewData.dias;
            setMontoManual(Math.round(valorDia * val));
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                <div className="modal-header">
                    <h2>🏖️ Vacaciones & SAC</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-icon">✕</button>
                </div>

                <div className="modal-tabs" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', padding: '0 var(--space-4)' }}>
                    <button 
                        className={`btn ${tab === 'sac' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setTab('sac')}
                    >
                        💰 Aguinaldo (SAC)
                    </button>
                    <button 
                        className={`btn ${tab === 'vacaciones' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setTab('vacaciones')}
                    >
                        🏖️ Vacaciones
                    </button>
                </div>

                <div className="modal-body" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                        <label className="form-label">Empleado</label>
                        <select 
                            className="form-select" 
                            value={selectedEmpleado} 
                            onChange={e => setSelectedEmpleado(e.target.value)}
                        >
                            <option value="">Seleccionar empleado...</option>
                            {empleados.map(e => (
                                <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Año</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={anio} 
                                onChange={e => setAnio(parseInt(e.target.value))} 
                            />
                        </div>
                        {tab === 'sac' && (
                            <div className="form-group">
                                <label className="form-label">Semestre</label>
                                <select 
                                    className="form-select" 
                                    value={semestre} 
                                    onChange={e => setSemestre(parseInt(e.target.value) as 1 | 2)}
                                >
                                    <option value={1}>1º Semestre (Ene-Jun)</option>
                                    <option value={2}>2º Semestre (Jul-Dic)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {loading && <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>Calculando...</div>}

                    {previewData && !loading && (
                        <div style={{ backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                            {tab === 'sac' ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <span>Mejor Bruto del Semestre:</span>
                                        <span style={{ fontWeight: 700 }}>${previewData.brutoMaximo?.toLocaleString() || '0'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <span>Días Proporcionales (base 180):</span>
                                        <span>{previewData.diasTrabajados || 0} días</span>
                                    </div>
                                    <hr style={{ margin: 'var(--space-2) 0', opacity: 0.2 }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                                        <strong>Monto SAC Sugerido:</strong>
                                        <strong>${previewData.sac?.toLocaleString() || '0'}</strong>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <span>Antigüedad Calculada:</span>
                                        <span>{previewData.antiguedad} años</span>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Días a Liquidar:</label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            value={diasManual} 
                                            onChange={e => handleDiasManualChange(parseInt(e.target.value) || 0)} 
                                        />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)', marginTop: '2px' }}>
                                            Sugerido por antigüedad: {previewData.dias} días
                                        </div>
                                    </div>
                                    <hr style={{ margin: 'var(--space-2) 0', opacity: 0.2 }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--color-success)' }}>
                                        <strong>Monto Vacaciones Sugerido:</strong>
                                        <strong>${montoManual?.toLocaleString() || '0'}</strong>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Inicio Goce:</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={fechaInicioGoce} 
                                                onChange={e => setFechaInicioGoce(e.target.value)} 
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Fin Goce:</label>
                                            <input 
                                                type="date" 
                                                className="form-input" 
                                                value={fechaFinGoce} 
                                                onChange={e => setFechaFinGoce(e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                                <label className="form-label">Confirmar Monto a Liquidar ($)</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ fontSize: '1.2rem', fontWeight: 700 }}
                                    value={montoManual || ''} 
                                    onChange={e => setMontoManual(parseFloat(e.target.value))} 
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Caja de Salida</label>
                        <select className="form-select" value={cajaId} onChange={e => setCajaId(e.target.value)}>
                            <option value="caja_chica">Caja Chica</option>
                            <option value="caja_madre">Caja Madre</option>
                            <option value="mercado_pago">Mercado Pago</option>
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
                    <button 
                        className="btn btn-primary" 
                        onClick={handleLiquidar}
                        disabled={loading || !selectedEmpleado || !montoManual}
                    >
                        🚀 Procesar Liquidación
                    </button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); animation: modalEnter 0.3s ease-out; }
                @keyframes modalEnter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .modal-tabs { border-bottom: 1px solid var(--color-gray-100); }
            `}</style>
        </div>
    )
}
