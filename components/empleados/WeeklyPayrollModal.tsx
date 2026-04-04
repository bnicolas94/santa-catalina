"use client"

import { useState, useEffect, Fragment } from 'react'
import { ResumenSemanal, DiaTrabajado } from '@/lib/payroll/calculoSueldoSemanal'

interface WeeklyPayrollModalProps {
    empleados: any[]
    onClose: () => void
    onSuccess: () => void
}

export function WeeklyPayrollModal({ empleados, onClose, onSuccess }: WeeklyPayrollModalProps) {
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
        return new Date(d.setDate(diff)).toISOString().split('T')[0]
    })
    const [fechaFin, setFechaFin] = useState(() => {
        const d = new Date()
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? 0 : 7) // Domingo
        return new Date(d.setDate(diff)).toISOString().split('T')[0]
    })
    const [cajaId, setCajaId] = useState('CAJA_CHICA')
    const [loading, setLoading] = useState(false)
    const [resultados, setResultados] = useState<any[]>([])
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [periodoNombre, setPeriodoNombre] = useState('')
    const [confirmando, setConfirmando] = useState(false)
    const [guardandoBorrador, setGuardandoBorrador] = useState(false)
    const [borradorCargado, setBorradorCargado] = useState(false)

    useEffect(() => {
        const [sy, sm, sd] = fechaInicio.split('-').map(Number);
        const [ey, em, ed] = fechaFin.split('-').map(Number);
        const d_start = new Date(sy, sm - 1, sd);
        const d_end = new Date(ey, em - 1, ed);
        setPeriodoNombre(`Semana del ${d_start.toLocaleDateString()} al ${d_end.toLocaleDateString()}`)
    }, [fechaInicio, fechaFin])

    const handleCalcular = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/liquidaciones/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoIds: empleados.filter(e => e.activo).map(e => e.id),
                    fechaInicio,
                    fechaFin
                })
            })
            const data = await res.json()
            
            // Buscar borradores guardados para este periodo
            try {
                // Generamos el nombre del periodo usando la misma lógica que el useEffect para que coincida con el de la DB
                const [sy, sm, sd] = fechaInicio.split('-').map(Number);
                const [ey, em, ed] = fechaFin.split('-').map(Number);
                const p_name = `Semana del ${new Date(sy, sm - 1, sd).toLocaleDateString()} al ${new Date(ey, em - 1, ed).toLocaleDateString()}`;

                const bRes = await fetch(`/api/liquidaciones/borrador?periodo=${encodeURIComponent(p_name)}`)
                if (bRes.ok) {
                    const borradores = await bRes.json()
                    if (borradores.length > 0) {
                        const merged = data.map((r: any) => {
                            const b = borradores.find((b: any) => b.empleadoId === r.empleadoId)
                            if (b) {
                                // REGLA: No usamos el totalNeto del borrador directo, sino que aplicamos 
                                // el ajuste del borrador al NUEVO cálculo de la API (para que justificaciones y cambios de sueldo se vean)
                                const adjustmentHs = b.ajusteHorasExtras || 0;
                                const adjustmentMoney = Math.round(adjustmentHs * r.valorHoraExtra);

                                return {
                                    ...r,
                                    ajusteHorasExtras: adjustmentHs,
                                    montoHorasExtras: r.montoHorasExtras + adjustmentMoney,
                                    totalNeto: r.totalNeto + adjustmentMoney,
                                    borradorId: b.id,
                                    // Guardamos originales para el cálculo local reactivo
                                    horasExtrasOriginal: r.horasExtras,
                                    totalNetoOriginal: r.totalNeto,
                                    montoHorasExtrasOriginal: r.montoHorasExtras
                                }
                            }
                            return r
                        })
                        setResultados(merged)
                        setBorradorCargado(true)
                    } else {
                        setResultados(data)
                        setBorradorCargado(false)
                    }
                } else {
                    setResultados(data)
                }
            } catch (e) {
                setResultados(data)
            }
        } catch (error) {
            console.error(error)
            alert('Error al calcular')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmarTodo = async () => {
        const validResults = resultados.filter(r => !r.error)
        if (validResults.length === 0) return

        if (!confirm(`¿Confirmas la liquidación final de ${validResults.length} empleados? Esto generará los egresos de caja.`)) return

        setConfirmando(true)
        try {
            for (const result of validResults) {
                const res = await fetch('/api/liquidaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId: result.empleadoId,
                        periodo: periodoNombre,
                        fechaInicio,
                        fechaFin,
                        cajaId,
                        calculatedData: result
                    })
                })
                if (!res.ok) {
                    const err = await res.json()
                    throw new Error(`Error con ${result.empleadoNombre}: ${err.error}`)
                }
                
                // Si había un borrador, borrarlo o se convierte automáticamente? 
                // Nuestra API actual de POST /api/liquidaciones CREA uno nuevo.
                // Podríamos borrar el borrador aquí si quisiéramos, pero el GET /api/liquidaciones/borrador solo trae "estado: borrador".
            }
            alert('¡Liquidaciones procesadas con éxito!')
            onSuccess()
            onClose()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setConfirmando(false)
        }
    }

    const handleGuardarTodoBorrador = async () => {
        setGuardandoBorrador(true)
        try {
            for (const result of resultados) {
                if (result.error) continue;
                await fetch('/api/liquidaciones/borrador', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId: result.empleadoId,
                        periodo: periodoNombre,
                        calculatedData: result
                    })
                })
            }
            setBorradorCargado(true)
            alert('¡Borrador guardado correctamente!')
        } catch (error) {
            alert('Error al guardar borrador')
        } finally {
            setGuardandoBorrador(false)
        }
    }

    const handleJustificar = async (empleadoId: string, fecha: string) => {
        try {
            const res = await fetch('/api/fichadas/justificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleadoId, fecha })
            })
            if (res.ok) handleCalcular()
            else alert('Error al justificar')
        } catch (error) { console.error(error) }
    }

    const handleQuitarJustificacion = async (empleadoId: string, fecha: string) => {
        try {
            const res = await fetch(`/api/fichadas/justificar?empleadoId=${empleadoId}&fecha=${fecha}`, {
                method: 'DELETE'
            })
            if (res.ok) handleCalcular()
            else alert('Error al quitar justificación')
        } catch (error) { console.error(error) }
    }

    const handleAjusteChange = (empleadoId: string, value: string) => {
        const val = parseFloat(value) || 0;
        setResultados(prev => prev.map(r => {
            if (r.empleadoId === empleadoId) {
                const baseExtras = r.horasExtrasOriginal ?? r.horasExtras;
                const baseMontoNeto = r.totalNetoOriginal ?? r.totalNeto;
                const baseMontoExtras = r.montoHorasExtrasOriginal ?? r.montoHorasExtras;
                
                const diffHs = val;
                const diffMonto = Math.round(diffHs * r.valorHoraExtra);
                
                return {
                    ...r,
                    ajusteHorasExtras: val,
                    montoHorasExtras: baseMontoExtras + diffMonto,
                    totalNeto: baseMontoNeto + diffMonto,
                    horasExtrasOriginal: baseExtras,
                    totalNetoOriginal: baseMontoNeto,
                    montoHorasExtrasOriginal: baseMontoExtras
                }
            }
            return r;
        }))
        setBorradorCargado(false) // Al cambiar algo, el borrador en cloud ya no coincide
    }

    const totalGeneral = resultados.reduce((acc, r) => acc + (r.totalNeto || 0), 0)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%', maxHeight: '90vh' }}>
                <div className="modal-header">
                    <div>
                        <h2>💰 Liquidación Semanal Automatizada</h2>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>Basado en fichadas del reloj y reglas de negocio configuradas.</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body" style={{ overflowY: 'auto' }}>
                    <div className="filters-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Desde (Lunes)</label>
                            <input type="date" className="form-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Hasta (Domingo)</label>
                            <input type="date" className="form-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} onClick={e => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Caja de Egreso</label>
                            <select className="form-select" value={cajaId} onChange={e => setCajaId(e.target.value)}>
                                <option value="CAJA_CHICA">Caja Chica</option>
                                <option value="BANCO">Banco</option>
                                <option value="ADMINISTRACION">Administración</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn btn-primary btn-block" onClick={handleCalcular} disabled={loading}>
                                {loading ? 'Calculando...' : '🔄 Calcular Sueldos'}
                            </button>
                        </div>
                    </div>

                    {resultados.length > 0 ? (
                        <div className="table-container shadow-sm" style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <table className="table table-sm">
                                <thead style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                    <tr>
                                        <th style={{ width: '30px' }}></th>
                                        <th>Empleado</th>
                                        <th style={{ textAlign: 'center' }}>Días</th>
                                        <th style={{ textAlign: 'right' }}>Sueldo Base</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Ajuste (hs)</th>
                                        <th style={{ textAlign: 'right' }}>Hs. Extras</th>
                                        <th style={{ textAlign: 'right' }}>Recargo Fer.</th>
                                        <th style={{ textAlign: 'right' }}>Deducciones</th>
                                        <th style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}>Neto a Pagar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultados.map((r) => (
                                        <Fragment key={r.empleadoId}>
                                            <tr onClick={() => !r.error && setExpandedRow(expandedRow === r.empleadoId ? null : r.empleadoId)} style={{ cursor: r.error ? 'default' : 'pointer', backgroundColor: expandedRow === r.empleadoId ? 'var(--color-info-bg)' : 'transparent', opacity: r.error ? 0.7 : 1 }}>
                                                <td>{!r.error && (expandedRow === r.empleadoId ? '▼' : '▶')}</td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {r.empleadoNombre || empleados.find(e => e.id === r.empleadoId)?.nombre || 'Empleado'}
                                                    {r.error && <span className="badge badge-danger" style={{ marginLeft: 'var(--space-2)', fontSize: '10px' }}>ERROR</span>}
                                                </td>
                                                {r.error ? (
                                                    <td colSpan={6} style={{ color: 'var(--color-danger)', fontSize: '12px', fontStyle: 'italic' }}>
                                                        Error: {r.error}
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td style={{ textAlign: 'center' }}>{r.diasTrabajados}</td>
                                                        <td style={{ textAlign: 'right' }}>${(r.sueldoBase || 0).toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                step="0.5" 
                                                                className="form-input" 
                                                                style={{ padding: '2px 5px', fontSize: '11px', textAlign: 'center', height: '24px' }} 
                                                                value={r.ajusteHorasExtras || ''} 
                                                                onChange={e => handleAjusteChange(r.empleadoId, e.target.value)} 
                                                                onClick={e => e.stopPropagation()}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                                            <span style={{ fontSize: '10px', display: 'block' }}>
                                                                ({(r.horasExtrasOriginal ?? r.horasExtras) + (r.ajusteHorasExtras || 0)}h)
                                                                {r.ajusteHorasExtras !== 0 && <span style={{ color: r.ajusteHorasExtras > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}> {r.ajusteHorasExtras > 0 ? '+' : ''}{r.ajusteHorasExtras}</span>}
                                                            </span>
                                                            ${(r.montoHorasExtras || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {(r.montoHorasFeriado || 0) > 0 && <span className="badge badge-warning" style={{ fontSize: '9px' }}>FER</span>}
                                                            ${(r.montoHorasFeriado || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--color-danger)' }}>
                                                            {(r.descuentoPrestamos || 0) > 0 && <span style={{ fontSize: '10px' }}>Préstamos</span>}
                                                            -${(r.descuentoPrestamos || 0).toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>${(r.totalNeto || 0).toLocaleString()}</td>
                                                    </>
                                                )}
                                            </tr>
                                            {expandedRow === r.empleadoId && (
                                                <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                                    <td colSpan={8} style={{ padding: 'var(--space-4)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
                                                            {r.desglosePorDia.map((dia: DiaTrabajado) => (
                                                                <div key={dia.fecha} style={{ backgroundColor: 'white', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: `1px solid ${dia.esFeriado ? 'var(--color-warning)' : 'var(--color-gray-200)'}`, fontSize: '11px', opacity: dia.horasTrabajadas > 0 ? 1 : 0.5 }}>
                                                                    <div style={{ fontWeight: 700, borderBottom: '1px solid var(--color-gray-100)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>{dia.diaSemana} {dia.fecha.split('-')[2]}</span>
                                                                        {dia.esFeriado && <span style={{ color: 'var(--color-warning)' }}>🚩</span>}
                                                                        {dia.esJustificado && <span className="badge badge-success" style={{ fontSize: '8px', padding: '1px 3px' }}>MANUAL</span>}
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <div>
                                                                            <div>{dia.entrada || '--:--'} a {dia.salida || '--:--'}</div>
                                                                            <div style={{ color: 'var(--color-gray-500)' }}>HS: {dia.horasTrabajadas} {dia.horasExtras > 0 && <span style={{ color: 'var(--color-success)' }}>(+{dia.horasExtras})</span>}</div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {dia.horasTrabajadas === 0 && (
                                                                                <button className="btn btn-ghost" title="Justificar día completo" onClick={() => handleJustificar(r.empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-success)' }}>🟢</button>
                                                                            )}
                                                                            {dia.esJustificado && (
                                                                                <button className="btn btn-ghost" title="Quitar justificación" onClick={() => handleQuitarJustificacion(r.empleadoId, dia.fecha)} style={{ padding: '2px', height: 'auto', fontSize: '14px', color: 'var(--color-danger)' }}>🔴</button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontWeight: 600, marginTop: '4px', textAlign: 'right' }}>${dia.totalDia.toLocaleString()}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))}
                                </tbody>
                                <tfoot style={{ backgroundColor: 'var(--color-gray-100)', fontWeight: 'bold' }}>
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'right' }}>TOTAL A PAGAR:</td>
                                        <td style={{ textAlign: 'right', fontSize: 'var(--text-lg)', color: 'var(--color-primary)' }}>${totalGeneral.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-gray-400)' }}>
                            <p style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📊</p>
                            <p>Presiona "Calcular Sueldos" para generar la previsualización del periodo.</p>
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                        {resultados.length > 0 && (
                            <button className="btn btn-outline" onClick={handleGuardarTodoBorrador} disabled={guardandoBorrador || confirmando}>
                                {guardandoBorrador ? 'Guardando...' : borradorCargado ? '✅ Borrador al día' : '💾 Guardar Borrador'}
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn-outline" onClick={onClose} disabled={confirmando}>Cerrar</button>
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', minWidth: '200px' }} onClick={handleConfirmarTodo} disabled={resultados.length === 0 || confirmando}>
                            {confirmando ? 'Procesando...' : `🚀 Finalizar y Liquidar (${resultados.length})`}
                        </button>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
                .modal { background: white; border-radius: var(--radius-xl); display: flex; flex-direction: column; box-shadow: var(--shadow-2xl); }
            `}</style>
        </div>
    )
}
