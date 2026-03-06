"use client"

import { useState, useEffect } from 'react'

interface MassLiquidationModalProps {
    empleados: any[]
    onClose: () => void
    onSuccess: () => void
}

export function MassLiquidationModal({ empleados, onClose, onSuccess }: MassLiquidationModalProps) {
    const [mes, setMes] = useState(new Date().toISOString().substring(0, 7))
    const [escaneando, setEscaneando] = useState(false)
    const [liquidando, setLiquidando] = useState(false)
    const [resultados, setResultados] = useState<any[]>([])
    const [cajas, setCajas] = useState<any[]>([])
    const [cajaSeleccionada, setCajaSeleccionada] = useState('caja_madre')
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Cargar cajas al inicio
    useEffect(() => {
        const fetchCajas = async () => {
            const res = await fetch('/api/caja/saldos')
            const data = await res.json()
            setCajas([
                { id: 'caja_madre', nombre: 'Caja Madre', saldo: data.cajaMadre?.saldo || 0 },
                { id: 'caja_chica', nombre: 'Caja Chica', saldo: data.cajaChica?.saldo || 0 },
                { id: 'local', nombre: 'Caja Local', saldo: data.local?.saldo || 0 }
            ])
        }
        fetchCajas()
    }, [])

    const scanAll = async () => {
        setEscaneando(true)
        setResultados([])
        setSelectedIds([])

        const start = `${mes}-01T00:00:00.000Z`
        let d = new Date(start)
        d.setMonth(d.getMonth() + 1)
        const end = d.toISOString()

        try {
            const scanPromises = empleados.filter(e => e.activo).map(async (emp) => {
                const res = await fetch(`/api/fichadas?empleadoId=${emp.id}&inicio=${start}&fin=${end}`)
                const fichadas = await res.json()

                if (fichadas.length === 0) {
                    return { ...emp, status: 'error', reason: 'Sin fichadas' }
                }

                // Agrupar por día para ver si hay impares
                const marcasPorDia: Record<string, any[]> = {}
                fichadas.forEach((f: any) => {
                    const df = new Date(f.fechaHora)
                    const fecha = df.toLocaleDateString()
                    if (!marcasPorDia[fecha]) marcasPorDia[fecha] = []
                    marcasPorDia[fecha].push(f)
                })

                const entries = Object.entries(marcasPorDia)
                const hasError = entries.some(([_, marcas]) => marcas.length % 2 !== 0)

                if (hasError) {
                    return { ...emp, status: 'error', reason: 'Marcas incompletas' }
                }

                return { ...emp, status: 'ok', count: fichadas.length }
            })

            const res = await Promise.all(scanPromises)
            setResultados(res)
            // Auto-seleccionar los que están OK
            setSelectedIds(res.filter(r => r.status === 'ok').map(r => r.id))
        } catch (error) {
            console.error(error)
        } finally {
            setEscaneando(false)
        }
    }

    useEffect(() => {
        scanAll()
    }, [mes])

    const handleLiquidarMasivo = async () => {
        if (!confirm(`¿Generar liquidación para ${selectedIds.length} empleados? Se procesará uno por uno.`)) return

        setLiquidando(true)
        let exitos = 0
        let errores = 0

        const start = `${mes}-01T00:00:00.000Z`
        let d = new Date(start)
        d.setMonth(d.getMonth() + 1)
        const end = d.toISOString()

        for (const id of selectedIds) {
            try {
                const emp = empleados.find(e => e.id === id)
                const res = await fetch('/api/liquidaciones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleadoId: id,
                        periodo: `Masivo - ${mes}`,
                        fechaInicio: start,
                        fechaFin: end,
                        cajaId: cajaSeleccionada,
                        concepto: 'pago_sueldo'
                    })
                })
                if (res.ok) exitos++
                else errores++
            } catch (e) {
                errores++
            }
        }

        alert(`Proceso masivo completado.\nÉxitos: ${exitos}\nErrores: ${errores}`)
        setLiquidando(false)
        onSuccess()
        onClose()
    }

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh' }}>
                <div className="modal-header">
                    <div>
                        <h2>🏢 Liquidación Masiva</h2>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>Procesa haberes de todo el personal validando su asistencia.</p>
                    </div>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Mes a Liquidar</label>
                            <input type="month" className="form-input" value={mes} onChange={e => setMes(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Caja de Pago</label>
                            <select className="form-select" value={cajaSeleccionada} onChange={e => setCajaSeleccionada(e.target.value)}>
                                {cajas.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre} (${c.saldo.toLocaleString()})</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-outline" onClick={scanAll} disabled={escaneando}>🔄 Re-escanear</button>
                    </div>

                    <div className="table-container" style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}></th>
                                    <th>Empleado</th>
                                    <th>Estado Asistencia</th>
                                    <th style={{ textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {escaneando ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>Escaneando asistencia de todo el personal...</td></tr>
                                ) : resultados.map(r => (
                                    <tr key={r.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                disabled={r.status === 'error'}
                                                checked={selectedIds.includes(r.id)}
                                                onChange={() => toggleSelection(r.id)}
                                            />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.nombre} {r.apellido}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>Cod: {r.codigoBiometrico}</div>
                                        </td>
                                        <td>
                                            {r.status === 'ok' ? (
                                                <span className="badge badge-success">✓ OK ({r.count} fichadas)</span>
                                            ) : (
                                                <span className="badge badge-danger">⚠️ {r.reason}</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {r.status === 'error' && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = `/empleados/${r.id}`}>Ver / Corregir</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
                    <button
                        className="btn btn-primary"
                        disabled={selectedIds.length === 0 || liquidando || escaneando}
                        onClick={handleLiquidarMasivo}
                    >
                        {liquidando ? 'Procesando...' : `Generar ${selectedIds.length} Liquidaciones`}
                    </button>
                </div>
            </div>
            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(2px); }
                .modal { background: white; border-radius: var(--radius-lg); display: flex; flex-direction: column; }
            `}</style>
        </div>
    )
}
