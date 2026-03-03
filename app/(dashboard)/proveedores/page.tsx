'use client'

import { useState, useEffect } from 'react'

interface Proveedor {
    id: string
    nombre: string
    contacto: string | null
    telefono: string | null
    email: string | null
    direccion: string | null
    activo: boolean
    _count: { insumos: number }
}

export default function ProveedoresPage() {
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({
        nombre: '',
        contacto: '',
        telefono: '',
        email: '',
        direccion: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        fetchProveedores()
    }, [])

    async function fetchProveedores() {
        try {
            const res = await fetch('/api/proveedores')
            setProveedores(await res.json())
        } catch {
            setError('Error al cargar proveedores')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        try {
            const res = await fetch('/api/proveedores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar')
            }

            setSuccess('Proveedor creado exitosamente')
            setShowModal(false)
            setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '' })
            fetchProveedores()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar')
        }
    }

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
                <p>Cargando proveedores...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="page-header">
                <h1>🚛 Proveedores</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    + Nuevo Proveedor
                </button>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Contacto</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Dirección</th>
                            <th>Insumos</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proveedores.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No hay proveedores registrados
                                </td>
                            </tr>
                        ) : (
                            proveedores.map((prov) => (
                                <tr key={prov.id}>
                                    <td style={{ fontWeight: 600 }}>{prov.nombre}</td>
                                    <td>{prov.contacto || '—'}</td>
                                    <td>{prov.telefono || '—'}</td>
                                    <td>{prov.email || '—'}</td>
                                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {prov.direccion || '—'}
                                    </td>
                                    <td>
                                        <span className="badge badge-info">{prov._count.insumos} insumos</span>
                                    </td>
                                    <td>
                                        <span className={`badge ${prov.activo ? 'badge-success' : 'badge-neutral'}`}>
                                            {prov.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nuevo Proveedor</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre del proveedor</label>
                                    <input
                                        className="form-input"
                                        value={form.nombre}
                                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                        required
                                        placeholder="Ej: Distribuidora Norte"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Contacto</label>
                                        <input
                                            className="form-input"
                                            value={form.contacto}
                                            onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                                            placeholder="Nombre del contacto"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Teléfono</label>
                                        <input
                                            className="form-input"
                                            value={form.telefono}
                                            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                            placeholder="+54 9 11 1234-5678"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="proveedor@email.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Dirección</label>
                                    <input
                                        className="form-input"
                                        value={form.direccion}
                                        onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                                        placeholder="Dirección completa"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Crear proveedor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
