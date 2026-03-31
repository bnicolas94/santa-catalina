'use client'

import { useState, useEffect } from 'react'

interface Cliente {
    id: string
    nombreComercial: string
    contactoNombre: string | null
    contactoTelefono: string | null
    direccion: string | null
    calle: string | null
    numero: string | null
    localidad: string | null
    zona: string | null
    segmento: string | null
    frecuenciaSemanal: number
    pedidoPromedioU: number
    activo: boolean
    _count: { pedidos: number }
}

const ZONAS = ['A', 'B', 'C', 'D']
const SEGMENTOS = [
    { value: 'A', label: 'A — Alto volumen' },
    { value: 'B', label: 'B — Medio volumen' },
    { value: 'C', label: 'C — Bajo volumen' },
]

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filterZona, setFilterZona] = useState('')
    const [form, setForm] = useState({
        nombreComercial: '', contactoNombre: '', contactoTelefono: '',
        calle: '', numero: '', localidad: '', zona: '', segmento: '',
        frecuenciaSemanal: '', pedidoPromedioU: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        try {
            const res = await fetch('/api/clientes')
            const data = await res.json()
            setClientes(Array.isArray(data) ? data : [])
        } catch { setError('Error al cargar clientes') } finally { setLoading(false) }
    }

    function resetForm() {
        setEditingId(null)
        setForm({ nombreComercial: '', contactoNombre: '', contactoTelefono: '', calle: '', numero: '', localidad: '', zona: '', segmento: '', frecuenciaSemanal: '', pedidoPromedioU: '' })
    }

    function openEdit(c: Cliente) {
        setEditingId(c.id)
        setForm({
            nombreComercial: c.nombreComercial, contactoNombre: c.contactoNombre || '',
            contactoTelefono: c.contactoTelefono || '', calle: c.calle || '', numero: c.numero || '',
            localidad: c.localidad || '', zona: c.zona || '', segmento: c.segmento || '',
            frecuenciaSemanal: String(c.frecuenciaSemanal), pedidoPromedioU: String(c.pedidoPromedioU),
        })
        setShowModal(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const url = editingId ? `/api/clientes/${editingId}` : '/api/clientes'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(editingId ? 'Cliente actualizado' : 'Cliente creado')
            setShowModal(false)
            resetForm()
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleDelete(id: string, nombre: string) {
        if (!confirm(`¿Eliminar "${nombre}"?`)) return
        try {
            await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
            setSuccess('Cliente eliminado')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al eliminar') }
    }

    async function handleLimpiarClientes() {
        if (filtered.length === 0) return;
        const confirmMsg = filterZona 
            ? `¿Estás seguro de que deseas eliminar los ${filtered.length} clientes de la Zona ${filterZona}? (Esta acción borrará también todos sus pedidos y entregas).`
            : `¿Estás seguro de que deseas eliminar TODOS los clientes (${clientes.length})? (Esta acción borrará todos los pedidos y entregas vinculadas).`;
        
        if (!confirm(confirmMsg)) return;

        try {
            setLoading(true);
            const ids = filtered.map(c => c.id);
            const res = await fetch('/api/clientes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) throw new Error();
            setSuccess(`${ids.length} clientes eliminados`);
            fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch { 
            setError('Error al eliminar clientes de forma masiva');
        } finally {
            setLoading(false);
        }
    }

    const filtered = filterZona ? clientes.filter((c) => c.zona === filterZona) : clientes

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando clientes...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>👥 Clientes</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {clientes.length > 0 && (
                        <button className="btn btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={handleLimpiarClientes}>
                            🧹 Limpiar
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>+ Nuevo Cliente</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Filtro por zona */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${filterZona === '' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterZona('')}>
                    Todos ({clientes.length})
                </button>
                {ZONAS.map((z) => {
                    const count = clientes.filter((c) => c.zona === z).length
                    return (
                        <button key={z} className={`btn btn-sm ${filterZona === z ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterZona(filterZona === z ? '' : z)}>
                            Zona {z} ({count})
                        </button>
                    )
                })}
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th className="hidden-mobile">Dirección</th>
                            <th className="hidden-mobile">Contacto</th>
                            <th className="hidden-mobile">Teléfono</th>
                            <th>Zona</th>
                            <th className="hidden-mobile">Pedidos</th>
                            <th>Acc.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No hay clientes registrados</td></tr>
                        ) : filtered.map((c) => (
                            <tr key={c.id}>
                                <td style={{ fontWeight: 600 }}>
                                    {c.nombreComercial}
                                    <div className="visible-mobile" style={{ fontSize: '10px', color: 'var(--color-gray-500)', fontWeight: 400 }}>
                                        {c.direccion || 'Sin dirección'}
                                    </div>
                                </td>
                                <td className="hidden-mobile" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', maxWidth: 200 }}>
                                    {c.direccion ? (
                                        <>
                                            <div>{c.direccion}</div>
                                            {(!c.localidad) && (
                                                <div style={{ color: 'var(--color-warning)', fontSize: '0.7rem', marginTop: '2px' }}>
                                                    ⚠️ Faltan datos (ej: localidad)
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--color-gray-400)' }}>Sin dirección</span>
                                    )}
                                </td>
                                <td className="hidden-mobile">{c.contactoNombre || '—'}</td>
                                <td className="hidden-mobile">{c.contactoTelefono || '—'}</td>
                                <td>{c.zona ? <span className="badge badge-info" style={{ fontSize: '10px' }}>{c.zona}</span> : '—'}</td>
                                <td className="hidden-mobile"><span className="badge badge-success">{c._count.pedidos}</span></td>
                                <td>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(c.id, c.nombreComercial)}>Eliminar</button>
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
                            <h2>{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre comercial</label>
                                    <input className="form-input" value={form.nombreComercial} onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })} required placeholder="Ej: Panadería Don José" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Contacto</label>
                                        <input className="form-input" value={form.contactoNombre} onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })} placeholder="Nombre del contacto" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Teléfono</label>
                                        <input className="form-input" value={form.contactoTelefono} onChange={(e) => setForm({ ...form, contactoTelefono: e.target.value })} placeholder="+54 9 11..." />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Calle</label>
                                        <input className="form-input" value={form.calle} onChange={(e) => setForm({ ...form, calle: e.target.value })} placeholder="Ej: Av. San Martín" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Número</label>
                                        <input className="form-input" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Ej: 1450" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Localidad / Ciudad <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                                    <input className="form-input" value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} required placeholder="Ej: Juan María Gutiérrez, Berazategui" />
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '4px' }}>Obligatorio para que Google Maps encuente el lugar exacto en la ruta.</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Zona</label>
                                        <select className="form-select" value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })}>
                                            <option value="">—</option>
                                            {ZONAS.map((z) => <option key={z} value={z}>Zona {z}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Segmento</label>
                                        <select className="form-select" value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })}>
                                            <option value="">—</option>
                                            {SEGMENTOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Freq/sem</label>
                                        <input type="number" className="form-input" value={form.frecuenciaSemanal} onChange={(e) => setForm({ ...form, frecuenciaSemanal: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Prom. unid</label>
                                        <input type="number" className="form-input" value={form.pedidoPromedioU} onChange={(e) => setForm({ ...form, pedidoPromedioU: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Guardar cambios' : 'Crear cliente'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
