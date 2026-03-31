// components/produccion/v2/modals/TransferModal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useProduccion } from '../ProduccionContext'

export const TransferModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { 
        productos, 
        ubicaciones, 
        mutate, 
        setError, 
        setSuccess 
    } = useProduccion()

    const [form, setForm] = useState({
        productoId: '',
        presentacionId: '',
        tipo: 'traslado',
        cantidad: '',
        observaciones: '',
        ubicacionId: '', // Origen
        destinoUbicacionId: '', // Destino
    })

    useEffect(() => {
        if (ubicaciones.length >= 2) {
            const fab = ubicaciones.find(u => u.tipo === 'FABRICA')
            const loc = ubicaciones.find(u => u.tipo === 'LOCAL')
            setForm(f => ({ ...f, ubicacionId: fab?.id || ubicaciones[0].id, destinoUbicacionId: loc?.id || ubicaciones[1].id }))
        }
    }, [ubicaciones])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/movimientos-producto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (res.ok) {
                setSuccess(`Traslado de stock registrado con éxito.`)
                mutate()
                onClose()
            } else {
                const data = await res.json()
                setError(data.error || 'Error en el traslado')
            }
        } catch (err) { setError('Error de red') }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                <div className="modal-header">
                    <h2>🚚 Traslado de Stock</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Producto</label>
                            <select className="form-select" value={form.productoId} onChange={(e) => {
                                const p = productos.find(x => x.id === e.target.value)
                                setForm({ ...form, productoId: e.target.value, presentacionId: p?.presentaciones?.[0]?.id || '' })
                            }} required>
                                <option value="">Seleccionar...</option>
                                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div className="form-group">
                                <label className="form-label">Desde (Origen)</label>
                                <select className="form-select" value={form.ubicacionId} onChange={(e) => setForm({ ...form, ubicacionId: e.target.value })} required>
                                    {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Hacia (Destino)</label>
                                <select className="form-select" value={form.destinoUbicacionId} onChange={(e) => setForm({ ...form, destinoUbicacionId: e.target.value })} required>
                                    {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cantidad (Paquetes)</label>
                            <input type="number" className="form-input" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required min="1" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Confirmar Traslado</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
