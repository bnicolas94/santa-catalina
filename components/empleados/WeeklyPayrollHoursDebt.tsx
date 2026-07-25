"use client"

import { useState } from 'react'

interface Props {
    empleadoId: string
    valorHoraExtra: number
    onDefer: (empleadoId: string, horas: string, monto: number) => void
    onManualDebt: (empleadoId: string, horas: string, monto: number) => void
}

export function WeeklyPayrollHoursDebt({ empleadoId, valorHoraExtra, onDefer, onManualDebt }: Props) {
    const [horasDiferidas, setHorasDiferidas] = useState('')
    const [horasAnteriores, setHorasAnteriores] = useState('')
    const monto = (horas: string) => Math.round(Number(horas) * valorHoraExtra)

    return <div style={{ marginTop: 'var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-gray-300)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-gray-600)', fontWeight: 600, marginBottom: '8px' }}>⏳ DIFERIR PARA EL PRÓXIMO SÁBADO</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={horasDiferidas} onChange={e => setHorasDiferidas(e.target.value)} className="form-input" placeholder="Cant. HS" style={{ width: '80px', height: '24px', fontSize: '11px' }} />
                <button className="btn btn-primary" style={{ height: '24px', fontSize: '10px', padding: '0 10px', backgroundColor: 'var(--color-gray-600)', borderColor: 'var(--color-gray-600)' }} onClick={() => { onDefer(empleadoId, horasDiferidas, monto(horasDiferidas)); setHorasDiferidas('') }}>Diferir</button>
            </div>
            <p style={{ fontSize: '9px', marginTop: '4px', color: 'var(--color-gray-400)' }}>Se descuentan de hoy y se pasan al sábado que viene.</p>
        </div>
        <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-primary)' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginBottom: '8px' }}>➕ CARGAR DEUDA DE SEMANA ANTERIOR</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="number" value={horasAnteriores} onChange={e => setHorasAnteriores(e.target.value)} className="form-input" placeholder="Cant. HS" style={{ width: '80px', height: '24px', fontSize: '11px' }} />
                <button className="btn btn-primary" style={{ height: '24px', fontSize: '10px', padding: '0 10px' }} onClick={() => { onManualDebt(empleadoId, horasAnteriores, monto(horasAnteriores)); setHorasAnteriores('') }}>Sumar a este Sábado</button>
            </div>
            <p style={{ fontSize: '9px', marginTop: '4px', color: 'var(--color-primary)' }}>Se suman directamente al total de hoy.</p>
        </div>
    </div>
}
