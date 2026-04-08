'use client'

import React, { useState } from 'react'
import { useProduccion } from '../ProduccionContext'

interface DiscountModalProps {
    onClose: () => void
    activeTurno: string
}

function getLocalDateString() {
    const tzOffset = new Date().getTimezoneOffset() * 60000
    return new Date(Date.now() - tzOffset).toISOString().slice(0, 10)
}

export function DiscountModal({ onClose, activeTurno }: DiscountModalProps) {
    const { planning, filterFecha, mutate, setSuccess, setError } = useProduccion()
    const [isDiscounting, setIsDiscounting] = useState(false)

    async function handleDescontar() {
        if (!activeTurno || activeTurno === 'Totales') return
        setIsDiscounting(true)
        try {
            const res = await fetch('/api/produccion/planificacion/descontar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: filterFecha || getLocalDateString(),
                    turno: activeTurno
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            mutate()
            onClose()
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsDiscounting(false)
        }
    }

    return (
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 9999 }} onClick={onClose}>
            <div className="modal" style={{ maxWidth: '500px', backgroundColor: '#fff' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Confirmar Descuento de Stock: {activeTurno}</h2>
                    <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <p style={{ margin: 0, color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>
                        Se descontarán los siguientes paquetes del **Stock de Fábrica**. Esta acción generará movimientos de egreso automáticos.
                    </p>
                    <div className="table-container" style={{ margin: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-sm)' }}>
                        <table className="table table-sm">
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#fff' }}>
                                <tr>
                                    <th>Producto</th>
                                    <th style={{ textAlign: 'center' }}>Total</th>
                                    <th style={{ textAlign: 'center' }}>A Descontar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries((planning?.necesidades?.[activeTurno] || {}) as Record<string, number>).map(([key, units]) => {
                                    const prod = planning?.infoProductos?.[key]
                                    if (!prod || !prod.presentacion || units <= 0 || prod.codigoInterno === 'ELE') return null
                                    const packetsToSubtract = Math.ceil(units / prod.presentacion.cantidad)
                                    return (
                                        <tr key={key}>
                                            <td style={{ fontSize: '12px' }}>
                                                <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{prod.codigoInterno}</span>
                                                <strong>{prod.nombre}</strong> (x{prod.presentacion.cantidad})
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{units} uni</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-danger" style={{ background: 'var(--color-danger)', color: '#fff', padding: '4px 10px', borderRadius: '14px', fontWeight: 700 }}>
                                                    -{packetsToSubtract} paq
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: '#FEF9E7', borderRadius: 'var(--radius-md)', border: '1px solid #F7DC6F', color: '#B7950B', fontSize: '11px' }}>
                        ⚠️ <strong>Nota:</strong> Solo se descuentan requerimientos destinados a Fábrica (Repartos). Los pedidos con destino "LOCAL" (Retiros) deben ser descontados desde logística o entrega final.
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={isDiscounting}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleDescontar} disabled={isDiscounting}>
                        {isDiscounting ? 'Descontando...' : 'Confirmar y Descontar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
