// components/produccion/v2/modals/MermaModal.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useProduccion } from '../ProduccionContext'

export const MermaModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
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
        planchas: '',
        motivo: '',
        ubicacionId: '',
    })

    useEffect(() => {
        if (!form.ubicacionId && ubicaciones.length > 0) {
            setForm(f => ({ ...f, ubicacionId: ubicaciones[0].id }))
        }
    }, [ubicaciones])

    const mermaProducto = productos.find(p => p.id === form.productoId)
    const planchasPorPaq = mermaProducto?.planchasPorPaquete || 6
    const planchasNum = parseFloat(form.planchas) || 0
    const paquetesMerma = Math.ceil(planchasNum / planchasPorPaq)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (paquetesMerma <= 0) return
        try {
            const res = await fetch('/api/movimientos-producto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: form.productoId,
                    presentacionId: form.presentacionId,
                    tipo: 'merma',
                    cantidad: paquetesMerma,
                    observaciones: `Merma ${planchasNum} planchas — ${form.motivo || 'Sin motivo'}`,
                    ubicacionId: form.ubicacionId,
                }),
            })
            if (res.ok) {
                setSuccess(`Merma registrada: ${planchasNum} planchas descuadradas.`)
                mutate()
                onClose()
            } else {
                setError('Error al registrar merma')
            }
        } catch (err) { setError('Error de red') }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>Registrar Merma de Planchas</h2>
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
                        <div className="form-group">
                            <label className="form-label">Cantidad de Planchas</label>
                            <input type="number" className="form-input" value={form.planchas} onChange={(e) => setForm({ ...form, planchas: e.target.value })} required />
                            {planchasNum > 0 && <small style={{ color: 'var(--color-primary)' }}>Equivale a ~{paquetesMerma} paquetes</small>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ubicación</label>
                            <select className="form-select" value={form.ubicacionId} onChange={(e) => setForm({ ...form, ubicacionId: e.target.value })} required>
                                {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Motivo / Observaciones</label>
                            <input type="text" className="form-input" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-danger">Confirmar Merma</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
