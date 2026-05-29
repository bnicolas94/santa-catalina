'use client'

import { useState, useEffect } from 'react'

interface Empleado {
    id: string
    nombre: string
    apellido: string | null
    talleUniforme?: {
        remera: string | null
        buzo: string | null
        impreso: boolean
    } | null
}

interface RowState {
    remeraTalle: string
    buzoTalle: string
    remeraCant: number
    buzoCant: number
}

interface Props {
    onClose: () => void
}

export function PlanillaUniformesModal({ onClose }: Props) {
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [rows, setRows] = useState<Record<string, RowState>>({})
    const [processingId, setProcessingId] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/uniformes')
            const data = await res.json()
            if (Array.isArray(data)) {
                setEmpleados(data)
                
                // Init row state
                const initialRows: Record<string, RowState> = {}
                data.forEach(emp => {
                    initialRows[emp.id] = {
                        remeraTalle: emp.talleUniforme?.remera || '',
                        buzoTalle: emp.talleUniforme?.buzo || '',
                        remeraCant: 0,
                        buzoCant: 0
                    }
                })
                setRows(initialRows)
            }
        } catch (error) {
            console.error('Error fetching uniformes:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRowChange = (empId: string, field: keyof RowState, value: string | number) => {
        setRows(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [field]: value
            }
        }))
    }

    const handleImprimir = async (emp: Empleado) => {
        const state = rows[emp.id]
        if (state.remeraCant === 0 && state.buzoCant === 0) {
            alert('Debes ingresar al menos 1 cantidad a entregar para poder imprimir el recibo.')
            return
        }

        setProcessingId(emp.id)
        try {
            const res = await fetch('/api/uniformes/imprimir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId: emp.id,
                    ...state
                })
            })
            
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al imprimir')
            
            // Open print tab
            window.open(`/empleados/${emp.id}/uniformes/imprimir/${data.entregaId}`, '_blank')
            
            // Refresh data to show impreso = true
            await fetchData()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>👕 Planilla Centralizada de Uniformes</h2>
                    <button onClick={onClose} className="btn-close">&times;</button>
                </div>

                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
                        {loading ? (
                            <div className="p-10 text-center">Cargando planilla...</div>
                        ) : (
                            <table className="table" style={{ width: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg)', zIndex: 10 }}>
                                    <tr>
                                        <th>Empleado</th>
                                        <th>Talle Remera</th>
                                        <th>Cant. Remera</th>
                                        <th>Talle Buzo</th>
                                        <th>Cant. Buzo</th>
                                        <th style={{ textAlign: 'center' }}>Impreso</th>
                                        <th style={{ textAlign: 'right' }}>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {empleados.map(emp => {
                                        const state = rows[emp.id]
                                        if (!state) return null
                                        
                                        const fueImpreso = emp.talleUniforme?.impreso || false

                                        return (
                                            <tr key={emp.id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {emp.nombre} {emp.apellido}
                                                </td>
                                                <td>
                                                    <input 
                                                        type="text" 
                                                        className="form-input" 
                                                        style={{ width: '80px', minHeight: '36px', padding: '4px 8px', fontSize: '14px' }}
                                                        placeholder="Talle"
                                                        value={state.remeraTalle}
                                                        onChange={(e) => handleRowChange(emp.id, 'remeraTalle', e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        style={{ width: '70px', minHeight: '36px', padding: '4px 8px', fontSize: '14px', textAlign: 'center' }}
                                                        min="0"
                                                        value={state.remeraCant}
                                                        onChange={(e) => handleRowChange(emp.id, 'remeraCant', parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        type="text" 
                                                        className="form-input" 
                                                        style={{ width: '80px', minHeight: '36px', padding: '4px 8px', fontSize: '14px' }}
                                                        placeholder="Talle"
                                                        value={state.buzoTalle}
                                                        onChange={(e) => handleRowChange(emp.id, 'buzoTalle', e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        type="number" 
                                                        className="form-input" 
                                                        style={{ width: '70px', minHeight: '36px', padding: '4px 8px', fontSize: '14px', textAlign: 'center' }}
                                                        min="0"
                                                        value={state.buzoCant}
                                                        onChange={(e) => handleRowChange(emp.id, 'buzoCant', parseInt(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={fueImpreso}
                                                        readOnly
                                                        style={{ width: '20px', height: '20px', cursor: 'default', accentColor: 'var(--color-primary)' }}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button 
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleImprimir(emp)}
                                                        disabled={processingId === emp.id}
                                                    >
                                                        {processingId === emp.id ? '...' : '🖨️ Imprimir'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                </div>
            </div>
        </div>
    )
}
