"use client"

import { useState } from 'react'
import type { AdicionalLiquidacionUI, ConceptoSalarialUI } from './weeklyPayroll.types'

interface Props {
    empleadoId: string
    adicionales: AdicionalLiquidacionUI[]
    conceptos: ConceptoSalarialUI[]
    onAdd: (empleadoId: string, conceptoId: string, monto: number) => void
    onRemove: (empleadoId: string, index: number) => void
}

export function WeeklyPayrollAdditionals({ empleadoId, adicionales, conceptos, onAdd, onRemove }: Props) {
    const [conceptoId, setConceptoId] = useState('')
    const [monto, setMonto] = useState('')

    const agregar = () => {
        const valor = Number(monto)
        if (!conceptoId || !Number.isFinite(valor) || valor === 0) return
        onAdd(empleadoId, conceptoId, valor)
        setMonto('')
    }

    return <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px dashed var(--color-gray-300)' }}>
        <h4 style={{ fontSize: '12px', marginBottom: 'var(--space-2)', color: 'var(--color-gray-700)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>➕ Conceptos Adicionales (Otros Pagos / Deudas)</h4>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {adicionales.map((adicional, index) => <div key={`${adicional.conceptoSalarialId}-${index}`} style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-primary)', padding: '4px 8px', borderRadius: 'var(--radius-md)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <strong>{adicional.nombre}:</strong> ${adicional.montoCalculado.toLocaleString()}
                <button onClick={() => onRemove(empleadoId, index)} style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}>✕</button>
            </div>)}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '2px 4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                <select value={conceptoId} onChange={e => setConceptoId(e.target.value)} className="form-select" style={{ height: '22px', fontSize: '10px', padding: '0 4px', width: '150px' }}>
                    <option value="">Seleccionar concepto...</option>
                    {conceptos.map(concepto => <option key={concepto.id} value={concepto.id}>{concepto.nombre}</option>)}
                </select>
                <input value={monto} onChange={e => setMonto(e.target.value)} type="number" className="form-input" placeholder="Monto" style={{ height: '22px', fontSize: '10px', width: '80px', padding: '0 4px' }} />
                <button className="btn btn-primary" style={{ height: '22px', padding: '0 8px', fontSize: '10px' }} onClick={agregar}>Añadir</button>
            </div>
        </div>
    </div>
}
