'use client'

import { useState, useEffect } from 'react'

interface Insumo { id: string; nombre: string; unidadMedida: string; stockActual: number }
interface Proveedor { id: string; nombre: string }
interface Movimiento {
    id: string; tipo: string; cantidad: number; fecha: string; observaciones: string | null
    costoTotal: number | null; estadoPago: string | null;
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
    const [filterFecha, setFilterFecha] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD local
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        insumoId: '', tipo: 'entrada', cantidad: '', observaciones: '', proveedorId: '',
        costoTotal: '', estadoPago: 'pagado', actualizarCosto: true,
        useBultos: false, bultos: '', unidadesPorBulto: '',
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
            const payloadParams = {
                ...form,
                cantidad: form.useBultos ? String(parseFloat(form.bultos) * parseFloat(form.unidadesPorBulto)) : form.cantidad,
            }

            const res = await fetch(editingId ? `/api/movimientos-stock/${editingId}` : '/api/movimientos-stock', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadParams),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(`Movimiento ${editingId ? 'actualizado' : 'registrado'} correctamente`)
            setShowModal(false)
            setEditingId(null)
            setForm({ insumoId: '', tipo: 'entrada', cantidad: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    function handleEdit(mov: Movimiento) {
        setEditingId(mov.id)
        setForm({
            insumoId: mov.insumo.id,
            tipo: mov.tipo,
            cantidad: String(mov.cantidad),
            observaciones: mov.observaciones || '',
            proveedorId: mov.proveedor?.id || '',
            costoTotal: mov.costoTotal ? String(mov.costoTotal) : '',
            estadoPago: mov.estadoPago || 'pagado',
            actualizarCosto: false, // Por defecto false al editar para no pisar sin querer
            useBultos: false,
            bultos: '',
            unidadesPorBulto: '',
        })
        setShowModal(true)
    }

    async function handlePago(id: string) {
        if (!confirm('¿Marcar compra como pagada y generar un Gasto Operativo en el reporte de Rentabilidad?')) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}/pago`, { method: 'PUT' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al pagar la compra')
            }
            setSuccess('Compra registrada como pagada.')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar este movimiento? Se revertirá la cantidad en el stock del insumo y se borrará el gasto asociado si existía.')) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar el movimiento')
            }
            setSuccess('Movimiento eliminado y stock revertido.')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    const movimientosPorFecha = filterFecha ? movimientos.filter((m) => {
        // Asumiendo que m.fecha viene de la DB ISO-string "YYYY-MM-DDTHH:mm:ss.sssZ"
        // Para compararla localmente extraemos sólo la porción de fecha en el fuso horario local
        const localDate = new Date(m.fecha)
        const dStr = localDate.toLocaleDateString('en-CA')
        return dStr === filterFecha
    }) : movimientos
    const filtered = filterTipo ? movimientosPorFecha.filter((m) => m.tipo === filterTipo) : movimientosPorFecha

    const statsEntradas = movimientosPorFecha.filter((m) => m.tipo === 'entrada').length
    const statsSalidas = movimientosPorFecha.filter((m) => m.tipo === 'salida').length

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando stock...</p></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>📊 Movimientos de Stock</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input
                        type="date"
                        className="form-input"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        title="Filtrar por fecha"
                        style={{ height: '38px' }}
                    />
                    {filterFecha && (
                        <button className="btn btn-ghost" onClick={() => setFilterFecha('')} title="Ver todas las fechas" style={{ padding: '0 8px', fontSize: '1.2rem' }}>
                            ✕
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null)
                        setForm({ insumoId: '', tipo: 'entrada', cantidad: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '' })
                        setShowModal(true)
                    }}>+ Registrar Movimiento</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                <button className={`btn btn-sm ${filterTipo === '' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterTipo('')}>
                    Todos ({movimientosPorFecha.length})
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
                            <th>Costo / Pago</th>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th>Observaciones</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
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
                                <td>
                                    {mov.tipo === 'entrada' && mov.costoTotal ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 600 }}>${mov.costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                            {mov.estadoPago === 'pendiente' ? (
                                                <button onClick={() => handlePago(mov.id)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#F39C1220', color: '#E67E22', border: '1px solid #F39C12', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                                    ⏳ Pendiente (Pagar)
                                                </button>
                                            ) : (
                                                <span className="badge" style={{ backgroundColor: '#2ECC7120', color: '#27AE60', border: '1px solid #2ECC71', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                                    ✅ Pagado
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#aaa' }}>—</span>
                                    )}
                                </td>
                                <td>{new Date(mov.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td>{mov.proveedor?.nombre || '—'}</td>
                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.observaciones || '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleEdit(mov)}
                                            className="btn btn-icon btn-ghost"
                                            style={{ color: 'var(--color-primary)' }}
                                            title="Editar movimiento"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(mov.id)}
                                            className="btn btn-icon btn-ghost"
                                            style={{ color: '#E74C3C' }}
                                            title="Eliminar movimiento"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
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
                            <h2>{editingId ? 'Editar' : 'Registrar'} Movimiento de Stock</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Tipo de movimiento</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm"
                                            disabled={!!editingId} // No permitir cambiar tipo al editar por seguridad
                                            onClick={() => setForm({ ...form, tipo: 'entrada' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: form.tipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600, opacity: editingId ? 0.6 : 1 }}>
                                            ⬆️ Entrada (compra/recepción)
                                        </button>
                                        <button type="button" className="btn btn-sm"
                                            disabled={!!editingId}
                                            onClick={() => setForm({ ...form, tipo: 'salida' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: form.tipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600, opacity: editingId ? 0.6 : 1 }}>
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
                                    {form.useBultos ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Bultos (Cajas/Maples)</label>
                                                <input type="number" step="0.01" className="form-input" value={form.bultos} onChange={(e) => setForm({ ...form, bultos: e.target.value })} required placeholder="Ej: 48" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>U. por Bulto</label>
                                                <input type="number" step="0.01" className="form-input" value={form.unidadesPorBulto} onChange={(e) => setForm({ ...form, unidadesPorBulto: e.target.value })} required placeholder="Ej: 30" />
                                            </div>
                                            {form.bultos && form.unidadesPorBulto && (
                                                <div style={{ gridColumn: '1 / -1', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>
                                                    <strong>Total: {(parseFloat(form.bultos) * parseFloat(form.unidadesPorBulto)).toLocaleString('es-AR')}</strong> unidades/kg
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="form-group">
                                            <label className="form-label">Cantidad Total</label>
                                            <input type="number" step="0.01" className="form-input" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} required placeholder="0" />
                                        </div>
                                    )}
                                    {form.tipo === 'entrada' && (
                                        <div className="form-group">
                                            <label className="form-label">Costo Total ($)</label>
                                            <input type="number" step="0.01" className="form-input" value={form.costoTotal} onChange={(e) => setForm({ ...form, costoTotal: e.target.value })} placeholder="0.00" />
                                            {form.costoTotal && form.insumoId && (form.cantidad || (form.useBultos && form.bultos && form.unidadesPorBulto)) && (
                                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                    Precio unitario calculado: <strong>${(parseFloat(form.costoTotal) / (form.useBultos ? parseFloat(form.bultos) * parseFloat(form.unidadesPorBulto) : parseFloat(form.cantidad))).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {insumos.find(i => i.id === form.insumoId)?.unidadMedida}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                                        <input type="checkbox" checked={form.useBultos} onChange={(e) => setForm({ ...form, useBultos: e.target.checked })} />
                                        Ingresar cantidad en bultos (P. ej: Maples, Cajas, Packs)
                                    </label>
                                </div>
                                {form.tipo === 'entrada' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Proveedor</label>
                                            <select className="form-select" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                                                <option value="">—</option>
                                                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Estado de Pago</label>
                                            <select className="form-select" value={form.estadoPago} onChange={(e) => setForm({ ...form, estadoPago: e.target.value })}>
                                                <option value="pagado">✅ Pagado (Contado)</option>
                                                <option value="pendiente">⏳ Pendiente (Cta. Cte.)</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                                <input type="checkbox" checked={form.actualizarCosto} onChange={(e) => setForm({ ...form, actualizarCosto: e.target.checked })} />
                                                Actualizar costo unitario del insumo
                                            </label>
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Observaciones</label>
                                    <input className="form-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional — motivo, # factura, etc." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Guardar Cambios' : `Registrar ${form.tipo === 'entrada' ? 'entrada' : 'salida'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
