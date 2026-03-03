'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Presentacion {
    id: string
    cantidad: number
    precioVenta: number
    activo: boolean
}

interface FichaTecnica {
    id: string
    cantidadPorUnidad: number
    unidadMedida: string
    insumo: { id: string; nombre: string; precioUnitario: number; unidadMedida: string }
}

interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    costoUnitario: number
    vidaUtilHoras: number
    planchasPorPaquete: number
    paquetesPorRonda: number
    activo: boolean
    presentaciones: Presentacion[]
    fichasTecnicas: FichaTecnica[]
}

export default function ProductosPage() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [showPresModal, setShowPresModal] = useState(false)
    const [presProducto, setPresProducto] = useState<Producto | null>(null)
    const [presForm, setPresForm] = useState({ cantidad: '', precioVenta: '' })
    const [form, setForm] = useState({
        nombre: '', codigoInterno: '', vidaUtilHoras: '48', tempConservacionMax: '4',
        planchasPorPaquete: '6', paquetesPorRonda: '14',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchProductos() }, [])

    async function fetchProductos() {
        try {
            const res = await fetch('/api/productos')
            const data = await res.json()
            setProductos(Array.isArray(data) ? data : [])
        } catch { setError('Error al cargar productos') } finally { setLoading(false) }
    }

    function resetForm() {
        setEditingId(null)
        setForm({ nombre: '', codigoInterno: '', vidaUtilHoras: '48', tempConservacionMax: '4', planchasPorPaquete: '6', paquetesPorRonda: '14' })
    }

    function openEdit(prod: Producto) {
        setEditingId(prod.id)
        setForm({
            nombre: prod.nombre, codigoInterno: prod.codigoInterno,
            vidaUtilHoras: String(prod.vidaUtilHoras), tempConservacionMax: '4',
            planchasPorPaquete: String(prod.planchasPorPaquete || 6),
            paquetesPorRonda: String(prod.paquetesPorRonda || 14),
        })
        setShowModal(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const url = editingId ? `/api/productos/${editingId}` : '/api/productos'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(editingId ? 'Producto actualizado' : 'Producto creado')
            setShowModal(false)
            resetForm()
            fetchProductos()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleDelete(id: string, nombre: string) {
        if (!confirm(`¿Eliminar "${nombre}" y todas sus presentaciones?`)) return
        try {
            const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Producto eliminado')
            fetchProductos()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    // --- Presentaciones ---
    function openPresentaciones(prod: Producto) {
        setPresProducto(prod)
        setPresForm({ cantidad: '', precioVenta: '' })
        setShowPresModal(true)
    }

    async function addPresentacion(e: React.FormEvent) {
        e.preventDefault()
        if (!presProducto) return
        setError('')
        try {
            const res = await fetch('/api/presentaciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productoId: presProducto.id, ...presForm }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setPresForm({ cantidad: '', precioVenta: '' })
            setSuccess('Presentación agregada')
            fetchProductos()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function deletePresentacion(presId: string) {
        if (!confirm('¿Eliminar esta presentación?')) return
        try {
            const res = await fetch(`/api/presentaciones/${presId}`, { method: 'DELETE' })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Presentación eliminada')
            fetchProductos()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    function calcularCDI(fichas: FichaTecnica[]): number {
        return fichas.reduce((acc, f) => acc + f.cantidadPorUnidad * f.insumo.precioUnitario, 0)
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando productos...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>📋 Productos</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ Nuevo Producto</button>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombre</th>
                            <th>Presentaciones</th>
                            <th>CDI / sándwich</th>
                            <th>Paq/Ronda</th>
                            <th>Receta</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No hay productos registrados.</td></tr>
                        ) : productos.map((prod) => {
                            const cdi = calcularCDI(prod.fichasTecnicas)
                            return (
                                <tr key={prod.id}>
                                    <td><span className="badge badge-neutral">{prod.codigoInterno}</span></td>
                                    <td style={{ fontWeight: 600 }}>{prod.nombre}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                            {prod.presentaciones.length > 0 ? prod.presentaciones.map((p) => (
                                                <span key={p.id} className="badge badge-info" style={{ fontSize: '11px' }}>
                                                    x{p.cantidad} → ${p.precioVenta.toLocaleString('es-AR')}
                                                </span>
                                            )) : <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-sm)' }}>Sin presentaciones</span>}
                                        </div>
                                    </td>
                                    <td>{cdi > 0 ? `$${cdi.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}</td>
                                    <td>{prod.paquetesPorRonda} paq · {prod.planchasPorPaquete} pl</td>
                                    <td>
                                        <span className={`badge ${prod.fichasTecnicas.length > 0 ? 'badge-success' : 'badge-warning'}`}>
                                            {prod.fichasTecnicas.length} insumos
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${prod.activo ? 'badge-success' : 'badge-neutral'}`}>
                                            {prod.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openPresentaciones(prod)}>📦 Presentaciones</button>
                                            <Link href={`/productos/${prod.id}`} className="btn btn-ghost btn-sm">Receta</Link>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(prod)}>Editar</button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(prod.id, prod.nombre)}>Eliminar</button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal Crear/Editar Producto */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Nombre del producto</label>
                                        <input className="form-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Ej: Jamón y Queso" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Código interno</label>
                                        <input className="form-input" value={form.codigoInterno} onChange={(e) => setForm({ ...form, codigoInterno: e.target.value.toUpperCase() })} required placeholder="JQ" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Vida útil (hs)</label>
                                        <input type="number" className="form-input" value={form.vidaUtilHoras} onChange={(e) => setForm({ ...form, vidaUtilHoras: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Temp. máx (°C)</label>
                                        <input type="number" step="0.1" className="form-input" value={form.tempConservacionMax} onChange={(e) => setForm({ ...form, tempConservacionMax: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Pl/paquete</label>
                                        <input type="number" className="form-input" value={form.planchasPorPaquete} onChange={(e) => setForm({ ...form, planchasPorPaquete: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Paq/ronda</label>
                                        <input type="number" className="form-input" value={form.paquetesPorRonda} onChange={(e) => setForm({ ...form, paquetesPorRonda: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Guardar cambios' : 'Crear producto'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Presentaciones */}
            {showPresModal && presProducto && (
                <div className="modal-overlay" onClick={() => setShowPresModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 550 }}>
                        <div className="modal-header">
                            <h2>📦 Presentaciones — {presProducto.nombre}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPresModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Lista de presentaciones existentes */}
                            {productos.find(p => p.id === presProducto.id)?.presentaciones.map((pres) => (
                                <div key={pres.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)',
                                    borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)',
                                }}>
                                    <div>
                                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)' }}>x{pres.cantidad}</span>
                                        <span style={{ marginLeft: 'var(--space-3)', color: 'var(--color-gray-600)' }}>
                                            ${pres.precioVenta.toLocaleString('es-AR')}
                                        </span>
                                        <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)' }}>
                                            (${(pres.precioVenta / pres.cantidad).toFixed(0)}/u)
                                        </span>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deletePresentacion(pres.id)}>Eliminar</button>
                                </div>
                            ))}

                            {/* Form agregar nueva */}
                            <form onSubmit={addPresentacion} style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-3)',
                                marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)',
                                borderTop: '1px solid var(--color-gray-200)',
                            }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Cantidad (sándwiches)</label>
                                    <input type="number" className="form-input" value={presForm.cantidad} onChange={(e) => setPresForm({ ...presForm, cantidad: e.target.value })} placeholder="48" required />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Precio ($)</label>
                                    <input type="number" step="0.01" className="form-input" value={presForm.precioVenta} onChange={(e) => setPresForm({ ...presForm, precioVenta: e.target.value })} placeholder="27000" required />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'end' }}>+ Agregar</button>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowPresModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
