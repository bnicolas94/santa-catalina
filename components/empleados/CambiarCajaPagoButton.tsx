'use client'

import { useState } from 'react'
import { cajasActivasParaLiquidacion, type CajaLiquidacion } from '@/lib/payroll/cajasLiquidacion'

interface Caja {
    id: string
    nombre: string
    saldo: number
}

interface Props {
    movimientoId: string
    cajaActual: string | null
    onSuccess: () => void | Promise<void>
    label?: string
    compact?: boolean
    disabled?: boolean
}

const dinero = (monto: number) => monto.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
})

export function CambiarCajaPagoButton({ movimientoId, cajaActual, onSuccess, label = 'Cambiar caja', compact = false, disabled = false }: Props) {
    const [abierto, setAbierto] = useState(false)
    const [cajas, setCajas] = useState<Caja[]>([])
    const [cajaNueva, setCajaNueva] = useState('')
    const [motivo, setMotivo] = useState('')
    const [cargando, setCargando] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    const abrir = async () => {
        setAbierto(true)
        setCargando(true)
        setError('')
        setMotivo('')
        try {
            const respuesta = await fetch('/api/caja/saldos')
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudieron cargar las cajas.')
            const catalogo = Array.isArray(data.cajas) ? data.cajas as Array<CajaLiquidacion & { saldo?: number }> : []
            const disponibles = cajasActivasParaLiquidacion(catalogo)
                .filter(caja => caja.tipo !== cajaActual)
                .map(caja => ({
                    id: caja.tipo,
                    nombre: `${caja.nombre || caja.tipo}${caja.ubicacion?.nombre ? ` · ${caja.ubicacion.nombre}` : ''}`,
                    saldo: Number(caja.saldo) || 0,
                }))
            setCajas(disponibles)
            setCajaNueva(disponibles[0]?.id || '')
        } catch (fetchError) {
            setError(fetchError instanceof Error ? fetchError.message : 'No se pudieron cargar las cajas.')
        } finally {
            setCargando(false)
        }
    }

    const guardar = async () => {
        if (!cajaNueva || motivo.trim().length < 10) return
        setGuardando(true)
        setError('')
        try {
            const respuesta = await fetch(`/api/empleados/movimientos-caja/${movimientoId}/reasignar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cajaNueva, motivo: motivo.trim() }),
            })
            const data = await respuesta.json()
            if (!respuesta.ok) throw new Error(data.error || 'No se pudo corregir la caja.')
            setAbierto(false)
            await onSuccess()
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'No se pudo corregir la caja.')
        } finally {
            setGuardando(false)
        }
    }

    return <>
        <button className={`btn btn-outline ${compact ? 'btn-sm' : ''}`} disabled={disabled || !cajaActual} onClick={() => void abrir()}>{label}</button>
        {abierto && <div className="modal-overlay" style={{ zIndex: 5000 }} onMouseDown={() => !guardando && setAbierto(false)}>
            <div className="modal" style={{ width: 'min(480px, calc(100vw - 32px))' }} onMouseDown={evento => evento.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <div style={{ color: 'var(--color-primary)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Corrección auditada</div>
                        <h3 style={{ margin: '4px 0 0' }}>Cambiar caja del pago</h3>
                    </div>
                    <button className="btn btn-ghost btn-icon" disabled={guardando} onClick={() => setAbierto(false)}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{ padding: 12, marginBottom: 16, color: '#175cd3', background: '#eff8ff', borderRadius: 8, fontSize: 12 }}>
                        Sólo se reasignará la caja. El importe, concepto, empleado, período y estado del pago permanecerán sin cambios.
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nueva caja de origen</label>
                        <select className="form-select" value={cajaNueva} onChange={evento => setCajaNueva(evento.target.value)} disabled={cargando || guardando}>
                            {cargando
                                ? <option>Cargando…</option>
                                : cajas.length > 0
                                    ? cajas.map(caja => <option value={caja.id} key={caja.id}>{caja.nombre} · {dinero(caja.saldo)}</option>)
                                    : <option value="">No hay otra caja activa disponible</option>}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Motivo de la corrección</label>
                        <textarea className="form-input" rows={4} maxLength={500} value={motivo} onChange={evento => setMotivo(evento.target.value)} disabled={guardando} placeholder="Ej. El pago salió de Caja Chica y se seleccionó Caja Fuerte por error." />
                        <div style={{ marginTop: 4, color: 'var(--color-gray-500)', fontSize: 11 }}>Entre 10 y 500 caracteres · {motivo.trim().length}/500</div>
                    </div>
                    {error && <div style={{ padding: 10, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 8, fontSize: 12 }}>{error}</div>}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-outline" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</button>
                    <button className="btn btn-primary" disabled={guardando || cargando || !cajaNueva || motivo.trim().length < 10} onClick={() => void guardar()}>{guardando ? 'Corrigiendo…' : 'Confirmar corrección'}</button>
                </div>
            </div>
        </div>}
    </>
}
