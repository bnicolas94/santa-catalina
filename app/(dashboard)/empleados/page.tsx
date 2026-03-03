'use client'

import { useState, useEffect } from 'react'

interface Empleado {
    id: string
    nombre: string
    email: string
    rol: string
    telefono: string | null
    activo: boolean
}

const ROLES = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'COORD_PROD', label: 'Coord. Producción' },
    { value: 'OPERARIO', label: 'Operario' },
    { value: 'LOGISTICA', label: 'Logística' },
    { value: 'ADMIN_OPS', label: 'Administrativo' },
]

export default function EmpleadosPage() {
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filterRol, setFilterRol] = useState('')
    const [form, setForm] = useState({
        nombre: '',
        email: '',
        password: '',
        rol: 'OPERARIO',
        telefono: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        fetchEmpleados()
    }, [])

    async function fetchEmpleados() {
        try {
            const res = await fetch('/api/empleados')
            const data = await res.json()
            setEmpleados(data)
        } catch {
            setError('Error al cargar empleados')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        try {
            const url = editingId ? `/api/empleados/${editingId}` : '/api/empleados'
            const method = editingId ? 'PUT' : 'POST'
            const body = editingId
                ? { nombre: form.nombre, email: form.email, rol: form.rol, telefono: form.telefono || null }
                : { ...form, telefono: form.telefono || null }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar')
            }

            setSuccess(editingId ? 'Empleado actualizado' : 'Empleado creado')
            setShowModal(false)
            resetForm()
            fetchEmpleados()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar')
        }
    }

    async function toggleActivo(id: string, activo: boolean) {
        try {
            await fetch(`/api/empleados/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: !activo }),
            })
            fetchEmpleados()
        } catch {
            setError('Error al actualizar estado')
        }
    }

    function openEdit(emp: Empleado) {
        setEditingId(emp.id)
        setForm({
            nombre: emp.nombre,
            email: emp.email,
            password: '',
            rol: emp.rol,
            telefono: emp.telefono || '',
        })
        setShowModal(true)
    }

    function resetForm() {
        setEditingId(null)
        setForm({ nombre: '', email: '', password: '', rol: 'OPERARIO', telefono: '' })
    }

    const filteredEmpleados = filterRol
        ? empleados.filter((e) => e.rol === filterRol)
        : empleados

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
                <p>Cargando empleados...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="page-header">
                <h1>⚙️ Empleados</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <select
                        className="form-select"
                        value={filterRol}
                        onChange={(e) => setFilterRol(e.target.value)}
                        style={{ minHeight: 40, width: 180 }}
                    >
                        <option value="">Todos los roles</option>
                        {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <button
                        className="btn btn-primary"
                        onClick={() => { resetForm(); setShowModal(true) }}
                    >
                        + Nuevo Empleado
                    </button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Teléfono</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmpleados.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No hay empleados registrados
                                </td>
                            </tr>
                        ) : (
                            filteredEmpleados.map((emp) => (
                                <tr key={emp.id}>
                                    <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                                    <td>{emp.email}</td>
                                    <td>
                                        <span className="badge badge-info">
                                            {ROLES.find((r) => r.value === emp.rol)?.label || emp.rol}
                                        </span>
                                    </td>
                                    <td>{emp.telefono || '—'}</td>
                                    <td>
                                        <span className={`badge ${emp.activo ? 'badge-success' : 'badge-neutral'}`}>
                                            {emp.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)}>
                                                Editar
                                            </button>
                                            <button
                                                className={`btn btn-sm ${emp.activo ? 'btn-ghost' : 'btn-outline'}`}
                                                onClick={() => toggleActivo(emp.id, emp.activo)}
                                            >
                                                {emp.activo ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </div>
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
                            <h2>{editingId ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre completo</label>
                                    <input
                                        className="form-input"
                                        value={form.nombre}
                                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                        required
                                        placeholder="Juan Pérez"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        required
                                        placeholder="juan@santacatalina.com"
                                    />
                                </div>
                                {!editingId && (
                                    <div className="form-group">
                                        <label className="form-label">Contraseña</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            required
                                            placeholder="Mínimo 6 caracteres"
                                            minLength={6}
                                        />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Rol</label>
                                    <select
                                        className="form-select"
                                        value={form.rol}
                                        onChange={(e) => setForm({ ...form, rol: e.target.value })}
                                    >
                                        {ROLES.map((r) => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Teléfono (opcional)</label>
                                    <input
                                        className="form-input"
                                        value={form.telefono}
                                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                                        placeholder="+54 9 11 1234-5678"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Guardar cambios' : 'Crear empleado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
