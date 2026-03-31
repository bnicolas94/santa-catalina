// components/produccion/v2/modals/CloseLotModal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useProduccion } from '../ProduccionContext'
import { Lote } from '../types'

interface CloseLotModalProps {
    lote: Lote
    onClose: () => void
}

export const CloseLotModal: React.FC<CloseLotModalProps> = ({ lote, onClose }) => {
    const { 
        coordinadores, 
        ubicaciones, 
        mutate, 
        setError, 
        setSuccess 
    } = useProduccion()

    const [form, setForm] = useState({
        unidadesRechazadas: String(lote.unidadesRechazadas),
        motivoRechazo: lote.motivoRechazo || '',
        estado: lote.estado,
        unidadesProducidas: String(lote.unidadesProducidas),
        empleadosRonda: String(lote.empleadosRonda),
        fechaProduccion: lote.fechaProduccion.slice(0, 10),
        coordinadorId: lote.coordinador?.id || '',
        ubicacionId: lote.ubicacion?.id || '',
        distribucionPresentaciones: [] as { presentacionId: string, cantidad: number }[]
    })

    useEffect(() => {
        const presentaciones = lote.producto.presentaciones || []
        const currentMovableItems = (lote as any).movimientosProducto || []
        
        const distribucion = presentaciones.map((p: any) => {
            const mov = currentMovableItems.find((m: any) => m.presentacionId === p.id)
            return {
                presentacionId: p.id,
                cantidad: mov ? mov.cantidad : (presentaciones.length === 1 ? lote.unidadesProducidas : 0)
            }
        })
        setForm(f => ({ ...f, distribucionPresentaciones: distribucion }))
    }, [lote])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(`/api/lotes/${lote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    horaFin: form.estado !== 'en_produccion' && lote.estado === 'en_produccion' ? new Date().toISOString() : null
                }),
            })
            if (res.ok) {
                setSuccess('Lote actualizado correctamente')
                mutate()
                onClose()
            } else {
                const data = await res.json()
                setError(data.error || 'Error al actualizar')
            }
        } catch (err) { setError('Error de red') }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2>Actualizar Lote #{lote.id}</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Estado del Lote</label>
                            <select className="form-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                                <option value="en_produccion">En Producción 🔧</option>
                                <option value="en_camara">En Cámara ❄️</option>
                                <option value="distribuido">Distribuido ✅</option>
                                <option value="merma">Merma ⚠️</option>
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label className="form-label">Paquetes Producidos</label>
                                <input type="number" className="form-input" value={form.unidadesProducidas} onChange={(e) => setForm({ ...form, unidadesProducidas: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Paquetes Rechazados</label>
                                <input type="number" className="form-input" value={form.unidadesRechazadas} onChange={(e) => setForm({ ...form, unidadesRechazadas: e.target.value })} />
                            </div>
                        </div>

                        {lote.producto.presentaciones && lote.producto.presentaciones.length > 0 && (
                            <div style={{ margin: '15px 0', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
                                <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>📦 Distribución por Presentación</h4>
                                {form.distribucionPresentaciones.map((d, i) => (
                                    <div key={d.presentacionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.85rem' }}>Presentación #{i + 1}</span>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            style={{ width: '100px' }} 
                                            value={d.cantidad} 
                                            onChange={(e) => {
                                                const newDist = [...form.distribucionPresentaciones]
                                                newDist[i].cantidad = parseInt(e.target.value) || 0
                                                setForm({ ...form, distribucionPresentaciones: newDist })
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Motivo de Rechazo (si hay)</label>
                            <input type="text" className="form-input" value={form.motivoRechazo} onChange={(e) => setForm({ ...form, motivoRechazo: e.target.value })} placeholder="Ej: Masa pegajosa" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
