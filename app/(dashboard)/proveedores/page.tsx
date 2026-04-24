'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Proveedor {
    id: string
    nombre: string
    contacto: string | null
    telefono: string | null
    email: string | null
    direccion: string | null
    categoria: string | null
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
        categoria: '',
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
            setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', categoria: '' })
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
                            <th>Categoría</th>
                            <th>Contacto</th>
                            <th>Teléfono</th>
                            <th>Insumos</th>
                            <th>Estado</th>
                            <th>Acciones</th>
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
                                <tr key={prov.id} className={!prov.activo ? 'opacity-50' : ''}>
                                    <td style={{ fontWeight: 600 }}>{prov.nombre}</td>
                                    <td>
                                        {prov.categoria ? (
                                            <span className="badge badge-neutral">{prov.categoria}</span>
                                        ) : (
                                            <span className="text-muted small">Sin categoría</span>
                                        )}
                                    </td>
                                    <td>{prov.contacto || '—'}</td>
                                    <td>{prov.telefono || '—'}</td>
                                    <td>
                                        <span className="badge badge-info">{prov._count.insumos} insumos</span>
                                    </td>
                                    <td>
                                        <span className={`badge ${prov.activo ? 'badge-success' : 'badge-neutral'}`}>
                                            {prov.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <Link href={`/proveedores/${prov.id}`} className="btn btn-ghost btn-sm">
                                            Ver Perfil
                                        </Link>
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                                        <label className="form-label">Categoría</label>
                                        <select
                                            className="form-input"
                                            value={form.categoria}
                                            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                                        >
                                            <option value="">Seleccionar categoría...</option>
                                            <option value="Materia Prima">Materia Prima</option>
                                            <option value="Servicios">Servicios</option>
                                            <option value="Mantenimiento">Mantenimiento</option>
                                            <option value="Embalaje">Embalaje</option>
                                            <option value="Otros">Otros</option>
                                        </select>
                                    </div>
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
