"use client"

import { useState, useEffect } from 'react'

interface Cuota {
    id: string
    numeroCuota: number
    monto: number
    estado: string // "pendiente", "pagada"
    mesAnio: string
}

interface Prestamo {
    id: string
    fechaSolicitud: string
    montoTotal: number
    cantidadCuotas: number
    estado: string // "activo", "pagado"
    frecuencia: string
    modoInicio: string
    observaciones: string | null
    cuotas: Cuota[]
}

export function PrestamosTab({ empleadoId }: { empleadoId: string }) {
    const [prestamos, setPrestamos] = useState<Prestamo[]>([])
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState({ 
        montoTotal: '', 
        cantidadCuotas: '1', 
        observaciones: '',
        frecuencia: 'SEMANAL',
        modoInicio: 'INMEDIATO',
        fechaInicio: '' 
    })

    const fetchPrestamos = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/empleados/${empleadoId}/prestamos`)
            const data = await res.json()
            setPrestamos(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPrestamos()
    }, [empleadoId])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(`/api/empleados/${empleadoId}/prestamos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            if (res.ok) {
                setForm({ 
                    montoTotal: '', 
                    cantidadCuotas: '1', 
                    observaciones: '',
                    frecuencia: 'SEMANAL',
                    modoInicio: 'INMEDIATO',
                    fechaInicio: ''
                })
                setShowNew(false)
                fetchPrestamos()
            } else {
                alert('Error al crear el préstamo')
            }
        } catch (error) {
            console.error(error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este préstamo? Esta acción borrará todas sus cuotas pendientes.')) return
        try {
            const res = await fetch(`/api/prestamos/${id}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchPrestamos()
            } else {
                const err = await res.json()
                alert(err.error || 'Error al eliminar el préstamo')
            }
        } catch (error) {
            console.error(error)
            alert('Error técnico al eliminar')
        }
    }

    if (loading) return <div className="p-10 text-center text-gray-400">Cargando préstamos...</div>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Historial de Préstamos y Adelantos</h3>
                </div>
                <button
                    onClick={() => setShowNew(!showNew)}
                    className="btn btn-primary"
                >
                    {showNew ? 'Cancelar' : '+ Otorgar Préstamo'}
                </button>
            </div>

            {showNew && (
                <div style={{ backgroundColor: 'var(--color-info-bg)', border: '1px solid var(--color-info)', padding: 'var(--space-5)', borderRadius: 'var(--radius-xl)' }}>
                    <h4 style={{ color: 'var(--color-info)', fontWeight: 500, marginBottom: 'var(--space-4)' }}>Nuevo Préstamo / Adelanto</h4>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Monto Total ($)</label>
                            <input required type="number" value={form.montoTotal} onChange={e => setForm({ ...form, montoTotal: e.target.value })} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cantidad de Cuotas</label>
                            <input required type="number" min="1" max="24" value={form.cantidadCuotas} onChange={e => setForm({ ...form, cantidadCuotas: e.target.value })} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Frecuencia</label>
                            <select value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value })} className="form-select">
                                <option value="SEMANAL">Semanal</option>
                                <option value="MENSUAL">Mensual</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modo de Inicio</label>
                            <select value={form.modoInicio} onChange={e => setForm({ ...form, modoInicio: e.target.value })} className="form-select">
                                <option value="INMEDIATO">Inmediato (Esta semana)</option>
                                <option value="FECHA_ESPECIFICA">A partir de fecha...</option>
                                <option value="AL_FINALIZAR_ANTERIOR">Al finalizar actual (Secuencial)</option>
                            </select>
                        </div>
                        {form.modoInicio === 'FECHA_ESPECIFICA' && (
                            <div className="form-group">
                                <label className="form-label">Fecha de Inicio</label>
                                <input type="date" value={form.fechaInicio} onChange={e => setForm({ ...form, fechaInicio: e.target.value })} className="form-input" />
                            </div>
                        )}
                        <div className="form-group" style={{ gridColumn: form.modoInicio === 'FECHA_ESPECIFICA' ? 'span 1' : 'span 2' }}>
                            <label className="form-label">Observaciones</label>
                            <input type="text" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej: Especial vacaciones" className="form-input" />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary">Confirmar y Generar Cuotas</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {prestamos.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay préstamos registrados para este empleado.</p>
                    </div>
                ) : (
                    prestamos.map(p => (
                        <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-4)' }}>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>
                                        ${p.montoTotal.toLocaleString()} en {p.cantidadCuotas} cuotas {p.frecuencia === 'SEMANAL' ? 'semanales' : 'mensuales'}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', marginTop: 'var(--space-1)' }}>
                                        {p.modoInicio === 'AL_FINALIZAR_ANTERIOR' ? '⏳ Secuencial ' : ''}
                                        Otorgado el {new Date(p.fechaSolicitud).toLocaleDateString()} {p.observaciones && `• ${p.observaciones}`}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span className={`badge ${p.estado === 'pagado' ? 'badge-success' : 'badge-warning'}`}>
                                        {p.estado === 'pagado' ? 'Saldado' : 'Activo'}
                                    </span>
                                    {p.estado !== 'pagado' && (
                                        <button 
                                            onClick={() => handleDelete(p.id)}
                                            style={{ 
                                                border: 'none', 
                                                background: 'none', 
                                                color: 'var(--color-danger)', 
                                                cursor: 'pointer',
                                                padding: 'var(--space-1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                opacity: 0.7
                                            }}
                                            title="Eliminar préstamo"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
                                {p.cuotas.map((c: Cuota) => (
                                    <div key={c.id} style={{
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: `1px solid ${c.estado === 'pagada' ? 'var(--color-success)' : 'var(--color-gray-200)'}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        backgroundColor: c.estado === 'pagada' ? 'var(--color-success-bg)' : 'var(--color-white)',
                                        opacity: c.estado === 'pagada' ? 0.7 : 1,
                                        boxShadow: c.estado === 'pagada' ? 'none' : 'var(--shadow-sm)'
                                    }}>
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Cuota {c.numeroCuota}/{p.cantidadCuotas}</span>
                                        <span style={{ fontWeight: 700, color: c.estado === 'pagada' ? 'var(--color-success)' : 'var(--color-gray-900)' }}>${c.monto.toLocaleString()}</span>
                                        <span style={{ fontSize: '10px', marginTop: 'var(--space-1)', fontWeight: 600, color: c.estado === 'pagada' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                            {c.estado === 'pagada' ? '✓ DESCONTADA' : 'PENDIENTE'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
