"use client"

import { useState, useEffect } from 'react'
import { DetalleConcepto } from '@/lib/services/liquidacion-final.service'

interface LiquidacionFinalModalProps {
    empleados?: any[]
    onClose: () => void
    onSuccess: () => void
    selectedEmpleadoId?: string
    empleado?: any
}

export default function LiquidacionFinalModal({ empleados = [], onClose, onSuccess, selectedEmpleadoId, empleado }: LiquidacionFinalModalProps) {
    const [empleadoId, setEmpleadoId] = useState(selectedEmpleadoId || empleado?.id || '')
    const [fechaEgreso, setFechaEgreso] = useState(new Date().toISOString().split('T')[0])
    const [causaEgreso, setCausaEgreso] = useState<'RENUNCIA' | 'DESPIDO_SIN_CAUSA' | 'DESPIDO_CON_CAUSA' | 'FIN_CONTRATO'>('RENUNCIA')
    const [omitirPreaviso, setOmitirPreaviso] = useState(true)
    const [loading, setLoading] = useState(false)
    const [calculo, setCalculo] = useState<any>(null)
    const [itemsEditables, setItemsEditables] = useState<DetalleConcepto[]>([])
    const [confirmando, setConfirmando] = useState(false)

    useEffect(() => {
        if (selectedEmpleadoId) {
            setEmpleadoId(selectedEmpleadoId)
        } else if (empleado?.id) {
            setEmpleadoId(empleado.id)
        }
    }, [selectedEmpleadoId, empleado?.id])

    const handleCalcular = async () => {
        if (!empleadoId) return alert('Seleccione un empleado')
        
        setLoading(true)
        try {
            const res = await fetch('/api/liquidaciones-finales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPreview: true,
                    input: {
                        empleadoId,
                        fechaEgreso,
                        causaEgreso,
                        omitirPreaviso
                    }
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al calcular')
            }

            const data = await res.json()
            setCalculo(data)
            setItemsEditables(data.items)
        } catch (error: any) {
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleItemChange = (index: number, value: string) => {
        const newItems = [...itemsEditables]
        newItems[index].monto = parseFloat(value) || 0
        setItemsEditables(newItems)
    }

    const handleAddItem = () => {
        setItemsEditables([...itemsEditables, {
            nombre: 'Nuevo Concepto',
            monto: 0,
            tipo: 'REMUNERATIVO',
            metodologia: 'Carga manual'
        }])
    }

    const handleRemoveItem = (index: number) => {
        setItemsEditables(itemsEditables.filter((_, i) => i !== index))
    }

    const handleConfirmar = async () => {
        if (!confirm('¿Está seguro de confirmar la liquidación final? El empleado quedará inactivo y se generará un movimiento en caja.')) return

        setConfirmando(true)
        try {
            const res = await fetch('/api/liquidaciones-finales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isPreview: false,
                    input: {
                        empleadoId,
                        fechaEgreso,
                        causaEgreso,
                        omitirPreaviso
                    },
                    itemsFinales: itemsEditables
                })
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al confirmar')
            }

            alert('Liquidación confirmada exitosamente')
            onSuccess()
            onClose()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setConfirmando(false)
        }
    }

    const totalHaberes = itemsEditables.filter(i => i.monto > 0).reduce((acc, i) => acc + i.monto, 0)
    const totalDescuentos = Math.abs(itemsEditables.filter(i => i.monto < 0).reduce((acc, i) => acc + i.monto, 0))
    const totalNeto = totalHaberes - totalDescuentos

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
                <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)', color: 'white' }}>
                    <div>
                        <h2 style={{ color: 'white' }}>📄 Liquidación Final LCT</h2>
                        <p style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>Cálculo automático según Ley 20.744 de Argentina</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ color: 'white' }}>✕</button>
                </div>

                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-gray-200)' }}>
                        <div className="form-group">
                            <label className="form-label">Empleado</label>
                            <select className="form-select" value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} disabled={!!selectedEmpleadoId || !!calculo}>
                                <option value="">Seleccionar...</option>
                                {empleados.length > 0 ? (
                                    empleados.filter(e => e.activo || e.id === empleadoId).map(e => (
                                        <option key={e.id} value={e.id}>{e.nombre} {e.apellido}</option>
                                    ))
                                ) : (
                                    empleado && <option value={empleado.id}>{empleado.nombre} {empleado.apellido}</option>
                                )}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Fecha de Egreso</label>
                            <input type="date" className="form-input" value={fechaEgreso} onChange={e => setFechaEgreso(e.target.value)} disabled={!!calculo} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Motivo de Egreso</label>
                            <select className="form-select" value={causaEgreso} onChange={e => setCausaEgreso(e.target.value as any)} disabled={!!calculo}>
                                <option value="RENUNCIA">Renuncia</option>
                                <option value="DESPIDO_SIN_CAUSA">Despido sin Causa</option>
                                <option value="DESPIDO_CON_CAUSA">Despido con Causa</option>
                                <option value="FIN_CONTRATO">Fin de Contrato</option>
                            </select>
                        </div>
                        {causaEgreso === 'DESPIDO_SIN_CAUSA' && (
                            <div className="form-group" style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <input type="checkbox" id="preaviso" checked={omitirPreaviso} onChange={e => setOmitirPreaviso(e.target.checked)} disabled={!!calculo} />
                                <label htmlFor="preaviso" style={{ marginBottom: 0, cursor: 'pointer' }}>Omitir preaviso (Pagar indemnización sustitutiva)</label>
                            </div>
                        )}
                        {!calculo && (
                            <div style={{ gridColumn: 'span 3', marginTop: 'var(--space-2)' }}>
                                <button className="btn btn-primary btn-block" onClick={handleCalcular} disabled={loading}>
                                    {loading ? <div className="spinner"></div> : '🔄 Calcular Liquidación'}
                                </button>
                            </div>
                        )}
                    </div>

                    {calculo && (
                        <div className="fade-in">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                                <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center', borderTop: '4px solid var(--color-info)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)' }}>ANTIGÜEDAD</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>{calculo.antiguedadAnios} años</div>
                                </div>
                                <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center', borderTop: '4px solid var(--color-gray-400)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)' }}>SUELDO REF.</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>${calculo.sueldoReferencia.toLocaleString()}</div>
                                </div>
                                <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center', borderTop: '4px solid var(--color-success)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)' }}>HABERES</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-success)' }}>${totalHaberes.toLocaleString()}</div>
                                </div>
                                <div className="card" style={{ padding: 'var(--space-3)', textAlign: 'center', borderTop: '4px solid var(--color-danger)' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--color-gray-400)' }}>DESCUENTOS</div>
                                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-danger)' }}>-${totalDescuentos.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="table-container" style={{ marginBottom: 'var(--space-4)' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Concepto</th>
                                            <th>Tipo</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                            <th style={{ width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsEditables.map((item, idx) => (
                                            <tr key={idx}>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        style={{ height: '32px', fontSize: 'var(--text-sm)', padding: '0 var(--space-2)' }} 
                                                        value={item.nombre} 
                                                        onChange={e => {
                                                            const newItems = [...itemsEditables]
                                                            newItems[idx].nombre = e.target.value
                                                            setItemsEditables(newItems)
                                                        }}
                                                    />
                                                    <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '2px' }}>{item.metodologia}</div>
                                                </td>
                                                <td>
                                                    <select 
                                                        className="form-select" 
                                                        style={{ height: '32px', fontSize: 'var(--text-xs)', padding: '0 var(--space-2)' }}
                                                        value={item.tipo}
                                                        onChange={e => {
                                                            const newItems = [...itemsEditables]
                                                            newItems[idx].tipo = e.target.value as any
                                                            setItemsEditables(newItems)
                                                        }}
                                                    >
                                                        <option value="REMUNERATIVO">Remunerativo</option>
                                                        <option value="NO_REMUNERATIVO">No Remunerativo</option>
                                                        <option value="DESCUENTO">Descuento</option>
                                                    </select>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        style={{ height: '32px', fontSize: 'var(--text-sm)', textAlign: 'right', padding: '0 var(--space-2)', width: '120px' }} 
                                                        value={item.monto} 
                                                        onChange={e => handleItemChange(idx, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveItem(idx)} style={{ color: 'var(--color-danger)' }}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL NETO:</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-primary)' }}>
                                                ${totalNeto.toLocaleString()}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button className="btn btn-outline btn-sm" onClick={handleAddItem}>➕ Añadir Concepto</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setCalculo(null)}>🔄 Resetear</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose} disabled={confirmando}>Cancelar</button>
                    {calculo && (
                        <button className="btn btn-primary" onClick={handleConfirmar} disabled={confirmando}>
                            {confirmando ? <div className="spinner"></div> : '✅ Confirmar Liquidación'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
