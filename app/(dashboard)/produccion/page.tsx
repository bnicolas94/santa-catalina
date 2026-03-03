'use client'

import { useState, useEffect } from 'react'

interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    planchasPorPaquete: number
    paquetesPorRonda: number
}

interface Coordinador {
    id: string
    nombre: string
}

interface Lote {
    id: string
    fechaProduccion: string
    horaInicio: string | null
    horaFin: string | null
    unidadesProducidas: number // paquetes
    unidadesRechazadas: number
    motivoRechazo: string | null
    empleadosRonda: number
    estado: string
    producto: Producto
    coordinador: Coordinador | null
}

const ESTADOS_LOTE = [
    { value: 'en_camara', label: 'En cámara', color: '#3498DB', emoji: '❄️' },
    { value: 'distribuido', label: 'Distribuido', color: '#2ECC71', emoji: '✅' },
    { value: 'merma', label: 'Merma', color: '#E74C3C', emoji: '⚠️' },
    { value: 'vencido', label: 'Vencido', color: '#95A5A6', emoji: '🕐' },
]

function getEstadoInfo(estado: string) {
    return ESTADOS_LOTE.find((e) => e.value === estado) || { value: estado, label: estado, color: '#607D8B', emoji: '❓' }
}

export default function ProduccionPage() {
    const [lotes, setLotes] = useState<Lote[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [coordinadores, setCoordinadores] = useState<Coordinador[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCerrarModal, setShowCerrarModal] = useState(false)
    const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null)
    const [filterEstado, setFilterEstado] = useState('')
    const [form, setForm] = useState({
        productoId: '',
        fechaProduccion: new Date().toISOString().slice(0, 10),
        rondas: '1',
        empleadosRonda: '1',
        coordinadorId: '',
    })
    const [cerrarForm, setCerrarForm] = useState({
        unidadesRechazadas: '0',
        motivoRechazo: '',
        estado: 'en_camara',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        try {
            const [lotesRes, prodRes, empRes] = await Promise.all([
                fetch('/api/lotes'),
                fetch('/api/productos'),
                fetch('/api/empleados'),
            ])
            const lotesData = await lotesRes.json()
            const prodData = await prodRes.json()
            const empData = await empRes.json()
            setLotes(Array.isArray(lotesData) ? lotesData : [])
            setProductos(Array.isArray(prodData) ? prodData : [])
            setCoordinadores(Array.isArray(empData) ? empData.filter((e: { rol: string; activo: boolean }) => ['ADMIN', 'COORD_PROD'].includes(e.rol) && e.activo) : [])
        } catch {
            setError('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    // Producto seleccionado en el form
    const productoSel = productos.find((p) => p.id === form.productoId)
    const rondasNum = parseInt(form.rondas) || 0
    const paquetesTotal = productoSel ? rondasNum * productoSel.paquetesPorRonda : 0
    const planchasTotal = productoSel ? paquetesTotal * productoSel.planchasPorPaquete : 0

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/lotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: form.productoId,
                    fechaProduccion: form.fechaProduccion,
                    unidadesProducidas: paquetesTotal, // guardamos paquetes
                    empleadosRonda: form.empleadosRonda,
                    coordinadorId: form.coordinadorId,
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            setSuccess(`Lote registrado — ${rondasNum} ronda${rondasNum > 1 ? 's' : ''}, ${paquetesTotal} paquetes`)
            setShowModal(false)
            setForm({ productoId: '', fechaProduccion: new Date().toISOString().slice(0, 10), rondas: '1', empleadosRonda: '1', coordinadorId: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    function openCerrarLote(lote: Lote) {
        setLoteSeleccionado(lote)
        setCerrarForm({ unidadesRechazadas: String(lote.unidadesRechazadas), motivoRechazo: lote.motivoRechazo || '', estado: lote.estado })
        setShowCerrarModal(true)
    }

    async function handleCerrarLote(e: React.FormEvent) {
        e.preventDefault()
        if (!loteSeleccionado) return
        setError('')
        try {
            const res = await fetch(`/api/lotes/${loteSeleccionado.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...cerrarForm,
                    horaFin: cerrarForm.estado !== 'en_camara' ? new Date().toISOString() : null,
                }),
            })
            if (!res.ok) throw new Error('Error al actualizar')
            setSuccess('Lote actualizado')
            setShowCerrarModal(false)
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    const filteredLotes = filterEstado ? lotes.filter((l) => l.estado === filterEstado) : lotes

    const stats = {
        total: lotes.length,
        enCamara: lotes.filter((l) => l.estado === 'en_camara').length,
        distribuido: lotes.filter((l) => l.estado === 'distribuido').length,
        merma: lotes.filter((l) => l.estado === 'merma').length,
        totalPaquetes: lotes.reduce((acc, l) => acc + l.unidadesProducidas, 0),
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando producción...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>🏭 Producción — Lotes</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Lote</button>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ cursor: 'pointer', border: filterEstado === '' ? '2px solid var(--color-primary)' : undefined }} onClick={() => setFilterEstado('')}>
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)' }}>{stats.totalPaquetes.toLocaleString()}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Paquetes producidos</div>
                    </div>
                </div>
                {ESTADOS_LOTE.slice(0, 3).map((est) => {
                    const count = lotes.filter((l) => l.estado === est.value).length
                    return (
                        <div key={est.value} className="card" style={{ cursor: 'pointer', border: filterEstado === est.value ? `2px solid ${est.color}` : undefined }} onClick={() => setFilterEstado(filterEstado === est.value ? '' : est.value)}>
                            <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: est.color }}>{count}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>{est.emoji} {est.label}</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Lote ID</th>
                            <th>Producto</th>
                            <th>Fecha</th>
                            <th>Paquetes</th>
                            <th>Planchas</th>
                            <th>Rechazos</th>
                            <th>Operarios</th>
                            <th>Coordinador</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLotes.length === 0 ? (
                            <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem' }}>No hay lotes registrados</td></tr>
                        ) : filteredLotes.map((lote) => {
                            const est = getEstadoInfo(lote.estado)
                            const mermaPercent = lote.unidadesProducidas > 0 ? ((lote.unidadesRechazadas / lote.unidadesProducidas) * 100).toFixed(1) : '0'
                            const planchas = lote.unidadesProducidas * (lote.producto.planchasPorPaquete || 6)
                            return (
                                <tr key={lote.id}>
                                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{lote.id}</td>
                                    <td>
                                        <span className="badge badge-neutral" style={{ marginRight: 6 }}>{lote.producto.codigoInterno}</span>
                                        {lote.producto.nombre}
                                    </td>
                                    <td>{new Date(lote.fechaProduccion).toLocaleDateString('es-AR')}</td>
                                    <td style={{ fontWeight: 600 }}>{lote.unidadesProducidas.toLocaleString()} paq</td>
                                    <td style={{ color: 'var(--color-gray-500)' }}>{planchas.toLocaleString()} pl</td>
                                    <td>
                                        {lote.unidadesRechazadas > 0 ? (
                                            <span style={{ color: parseFloat(mermaPercent) > 5 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                                {lote.unidadesRechazadas} paq ({mermaPercent}%)
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td>{lote.empleadosRonda}</td>
                                    <td>{lote.coordinador?.nombre || '—'}</td>
                                    <td>
                                        <span className="badge" style={{ backgroundColor: `${est.color}20`, color: est.color, border: `1px solid ${est.color}40` }}>
                                            {est.emoji} {est.label}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openCerrarLote(lote)}>Gestionar</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal Nuevo Lote */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Nuevo Lote</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Producto</label>
                                    <select className="form-select" value={form.productoId} onChange={(e) => setForm({ ...form, productoId: e.target.value })} required>
                                        <option value="">Seleccionar producto...</option>
                                        {productos.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.codigoInterno}] {p.nombre} — {p.paquetesPorRonda} paq/ronda, {p.planchasPorPaquete} pl/paq
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de producción</label>
                                        <input type="date" className="form-input" value={form.fechaProduccion} onChange={(e) => setForm({ ...form, fechaProduccion: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad de rondas</label>
                                        <input type="number" className="form-input" value={form.rondas} onChange={(e) => setForm({ ...form, rondas: e.target.value })} required placeholder="1" min="1" />
                                    </div>
                                </div>

                                {/* Resumen calculado */}
                                {productoSel && rondasNum > 0 && (
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)',
                                        padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)',
                                        borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-4)',
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{rondasNum}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Ronda{rondasNum > 1 ? 's' : ''}</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{paquetesTotal}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Paquetes</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{planchasTotal}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Planchas</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Operarios en ronda</label>
                                        <input type="number" className="form-input" value={form.empleadosRonda} onChange={(e) => setForm({ ...form, empleadosRonda: e.target.value })} placeholder="1" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Coordinador</label>
                                        <select className="form-select" value={form.coordinadorId} onChange={(e) => setForm({ ...form, coordinadorId: e.target.value })}>
                                            <option value="">Sin asignar</option>
                                            {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Registrar lote</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Gestionar Lote */}
            {showCerrarModal && loteSeleccionado && (
                <div className="modal-overlay" onClick={() => setShowCerrarModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Gestionar Lote {loteSeleccionado.id}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCerrarModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCerrarLote}>
                            <div className="modal-body">
                                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                    <strong>{loteSeleccionado.producto.nombre}</strong> — {loteSeleccionado.unidadesProducidas} paquetes
                                    ({loteSeleccionado.unidadesProducidas * (loteSeleccionado.producto.planchasPorPaquete || 6)} planchas)
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado del lote</label>
                                    <select className="form-select" value={cerrarForm.estado} onChange={(e) => setCerrarForm({ ...cerrarForm, estado: e.target.value })}>
                                        {ESTADOS_LOTE.map((e) => <option key={e.value} value={e.value}>{e.emoji} {e.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Paquetes rechazados</label>
                                        <input type="number" className="form-input" value={cerrarForm.unidadesRechazadas} onChange={(e) => setCerrarForm({ ...cerrarForm, unidadesRechazadas: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo rechazo</label>
                                        <input className="form-input" value={cerrarForm.motivoRechazo} onChange={(e) => setCerrarForm({ ...cerrarForm, motivoRechazo: e.target.value })} placeholder="Opcional" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCerrarModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
