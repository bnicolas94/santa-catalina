"use client"

import { useState, useEffect } from 'react'

interface Role {
    id: string
    nombre: string
    descripcion: string | null
    color: string | null
}

interface RolesConfigModalProps {
    onClose: () => void
    onRolesChanged: () => void
}

export default function RolesConfigModal({ onClose, onRolesChanged }: RolesConfigModalProps) {
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [editRole, setEditRole] = useState<Partial<Role> | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchRoles()
    }, [])

    const fetchRoles = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/empleados/roles')
            const data = await res.json()
            setRoles(data)
        } catch (err) {
            setError('Error al cargar roles')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editRole?.nombre) return

        try {
            const url = editRole.id ? `/api/empleados/roles/${editRole.id}` : '/api/empleados/roles'
            const method = editRole.id ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editRole)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar rol')
            }

            setEditRole(null)
            fetchRoles()
            onRolesChanged()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que desea eliminar este rol?')) return

        try {
            const res = await fetch(`/api/empleados/roles/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar')
            }
            fetchRoles()
            onRolesChanged()
        } catch (err: any) {
            alert(err.message)
        }
    }

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '2rem', borderRadius: '12px',
                width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Gestionar Roles</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                {editRole ? (
                    <form onSubmit={handleSave} style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
                        <h3>{editRole.id ? 'Editar Rol' : 'Nuevo Rol'}</h3>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre</label>
                            <input
                                className="form-input"
                                value={editRole.nombre || ''}
                                onChange={e => setEditRole({ ...editRole, nombre: e.target.value.toUpperCase() })}
                                placeholder="EJ: SUPERVISOR"
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Descripción</label>
                            <input
                                className="form-input"
                                value={editRole.descripcion || ''}
                                onChange={e => setEditRole({ ...editRole, descripcion: e.target.value })}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn btn-primary">Guardar</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditRole(null)}>Cancelar</button>
                        </div>
                    </form>
                ) : (
                    <button
                        className="btn btn-primary"
                        style={{ marginBottom: '1.5rem', width: '100%' }}
                        onClick={() => setEditRole({ nombre: '', descripcion: '' })}
                    >
                        + Crear Nuevo Rol
                    </button>
                )}

                {loading ? <p>Cargando...</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {roles.map(rol => (
                            <div key={rol.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '6px'
                            }}>
                                <div>
                                    <strong style={{ display: 'block' }}>{rol.nombre}</strong>
                                    {rol.descripcion && <small style={{ color: '#666' }}>{rol.descripcion}</small>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setEditRole(rol)}
                                        style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rol.id)}
                                        style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                                    >
                                        Borrar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
