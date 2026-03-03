'use client'

import { useState, useEffect } from 'react'

interface Insumo { id: string; nombre: string; unidadMedida: string; stockActual: number }
interface Proveedor { id: string; nombre: string }
interface Movimiento {
    id: string; tipo: string; cantidad: number; fecha: string; observaciones: string | null
    insumo: { id: string; nombre: string; unidadMedida: string }
    proveedor: { id: string; nombre: string } | null
}

export default function StockPage() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filterTipo, setFilterTipo] = useState('')
    const [form, setForm] = useState({
        insumoId: '', tipo: 'entrada', cantidad: '', observaciones: '', proveedorId: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        try {
            const [movRes, insRes, provRes] = await Promise.all([
                fetch('/api/movimientos-stock'), fetch('/api/insumos'), fetch('/api/proveedores'),
            ])
            const movData = await movRes.json()
            const insData = await insRes.json()
            const provData = await provRes.json()
            setMovimientos(Array.isArray(movData) ? movData : [])
            setInsumos(Array.isArray(insData) ? insData : [])
            setProveedores(Array.isArray(provData) ? provData : [])
        } catch { setError('Error al cargar datos') } finally { setLoading(false) }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/movimientos-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(`${form.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada — stock actualizado`)
            setShowModal(false)
            setForm({ insumoId: '', tipo: 'entrada', cantidad: '', observaciones: '', proveedorId: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    const filtered = filterTipo ? movimientos.filter((m) => m.tipo === filterTipo) : movimientos

    const statsEntradas = movimientos.filter((m) => m.tipo === 'entrada').length
    const statsSalidas = movimientos.filter((m) => m.tipo === 'salida').length

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando stock...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>📊 Movimientos de Stock</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Registrar Movimiento</button>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                <button className={`btn btn-sm ${filterTipo === '' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterTipo('')}>
                    Todos ({movimientos.length})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'entrada' ? '' : 'entrada')}
                    style={{ backgroundColor: filterTipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: filterTipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600 }}>
                    ⬆️ Entradas ({statsEntradas})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'salida' ? '' : 'salida')}
                    style={{ backgroundColor: filterTipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: filterTipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600 }}>
                    ⬇️ Salidas ({statsSalidas})
                </button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Insumo</th>
                            <th>Cantidad</th>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th>Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay movimientos registrados</td></tr>
                        ) : filtered.map((mov) => (
                            <tr key={mov.id}>
                                <td>
                                    <span className="badge" style={{
                                        backgroundColor: mov.tipo === 'entrada' ? '#2ECC7120' : '#E74C3C20',
                                        color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C',
                                        border: `1px solid ${mov.tipo === 'entrada' ? '#2ECC7140' : '#E74C3C40'}`,
                                    }}>
                                        {mov.tipo === 'entrada' ? '⬆️ Entrada' : '⬇️ Salida'}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{mov.insumo.nombre}</td>
                                <td>
                                    <span style={{ color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C', fontWeight: 700 }}>
                                        {mov.tipo === 'entrada' ? '+' : '−'}{mov.cantidad} {mov.insumo.unidadMedida}
                                    </span>
                                </td>
                                <td>{new Date(mov.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td>{mov.proveedor?.nombre || '—'}</td>
                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.observaciones || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Movimiento de Stock</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Tipo de movimiento</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm" onClick={() => setForm({ ...form, tipo: 'entrada' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: form.tipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600 }}>
                                            ⬆️ Entrada (compra/recepción)
                                        </button>
                                        <button type="button" className="btn btn-sm" onClick={() => setForm({ ...form, tipo: 'salida' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: form.tipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600 }}>
                                            ⬇️ Salida (uso/merma)
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Insumo</label>
                                    <select className="form-select" value={form.insumoId} onChange={(e) => setForm({ ...form, insumoId: e.target.value })} required>
                                        <option value="">Seleccionar insumo...</option>
                                        {insumos.map((ins) => (
                                            <option key={ins.id} value={ins.id}>
                                                {ins.nombre} (stock: {ins.stockActual} {ins.unidadMedida})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad</label>
                                        <input type="number" step="0.01" className="form-input" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required placeholder="0" />
                                    </div>
                                    {form.tipo === 'entrada' && (
                                        <div className="form-group">
                                            <label className="form-label">Proveedor</label>
                                            <select className="form-select" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                                                <option value="">—</option>
                                                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observaciones</label>
                                    <input className="form-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional — motivo, # factura, etc." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">
                                    Registrar {form.tipo === 'entrada' ? 'entrada' : 'salida'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
