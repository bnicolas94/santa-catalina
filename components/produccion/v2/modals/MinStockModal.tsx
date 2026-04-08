'use client'

import React, { useState } from 'react'
import { useProduccion } from '../ProduccionContext'

interface MinStockModalProps {
    onClose: () => void
    initialPresentacionId: string
    initialStockMinimo: string
}

export function MinStockModal({ onClose, initialPresentacionId, initialStockMinimo }: MinStockModalProps) {
    const { mutate, setSuccess, setError } = useProduccion()
    const [stockMinimo, setStockMinimo] = useState(initialStockMinimo)
    const [loading, setLoading] = useState(false)

    async function handleMinStockSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch(`/api/presentaciones/${initialPresentacionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stockMinimo }),
            })
            if (!res.ok) throw new Error('Error al actualizar stock mínimo')
            setSuccess('Stock mínimo actualizado correctamente')
            mutate()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2 style={{ margin: 0 }}>⚙️ Configurar Alerta</h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleMinStockSubmit}>
                    <div className="modal-body">
                        <p style={{ fontSize: '14px', marginBottom: 'var(--space-4)' }}>
                            Definí el stock mínimo en <strong>Fábrica</strong> para recibir una alerta visual cuando los paquetes disponibles bajen de este nivel.
                        </p>
                        <div className="form-group">
                            <label className="form-label">Stock Mínimo (paquetes)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={stockMinimo}
                                onChange={e => setStockMinimo(e.target.value)}
                                placeholder="Ej: 10"
                                required
                                min="0"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar configuración'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
