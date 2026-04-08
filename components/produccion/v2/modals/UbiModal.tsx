'use client'

import React, { useState } from 'react'
import { useProduccion } from '../ProduccionContext'

interface UbiModalProps {
    onClose: () => void
}

export function UbiModal({ onClose }: UbiModalProps) {
    const { ubicaciones, mutate, setError } = useProduccion()
    const [nombre, setNombre] = useState('')
    const [tipo, setTipo] = useState('FABRICA')
    const [loading, setLoading] = useState(false)

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/ubicaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, tipo })
            })
            if (!res.ok) throw new Error('Error al guardar')
            setNombre('')
            setTipo('FABRICA')
            mutate()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(u: any) {
        if (!confirm(`¿Eliminar la sede ${u.nombre}? Se perderán las asociaciones de stock.`)) return
        try {
            const res = await fetch(`/api/ubicaciones?id=${u.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Error al eliminar')
            mutate()
        } catch (err: any) {
            setError(err.message)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h2 style={{ margin: 0 }}>📍 Gestionar Sedes (Fábricas/Locales)</h2>
                    <button className="btn btn-ghost" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Nombre (ej: Villa Elisa)</label>
                            <input className="form-input" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Ej: Villa Elisa" />
                        </div>
                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Tipo</label>
                            <select className="form-input" value={tipo} onChange={e => setTipo(e.target.value)}>
                                <option value="FABRICA">🏭 Fábrica</option>
                                <option value="LOCAL">🏪 Local / Venta</option>
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '38px' }} disabled={loading}>Añadir</button>
                    </form>

                    <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ubicaciones.map((u: any) => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                                        <td>
                                            <span className="badge" style={{ background: u.tipo === 'FABRICA' ? '#E8F5E9' : '#E3F2FD', color: u.tipo === 'FABRICA' ? '#2E7D32' : '#1565C0', border: 'none' }}>
                                                {u.tipo === 'FABRICA' ? '🏭 Fábrica' : '🏪 Local'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-icon btn-ghost" style={{ color: '#E74C3C' }} onClick={() => handleDelete(u)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                                {ubicaciones.length === 0 && (
                                    <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No hay sedes configuradas. Configurá al menos una para operar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
