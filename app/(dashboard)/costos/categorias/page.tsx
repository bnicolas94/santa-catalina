"use client"

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

interface CategoriaGasto {
    id: string
    nombre: string
    color: string
    esOperativo: boolean
}

export default function GestionCategoriasPage() {
    const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
    const [loading, setLoading] = useState(true)

    // Modal helpers
    const [showModal, setShowModal] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        id: '',
        nombre: '',
        color: '#E74C3C'
    })

    useEffect(() => {
        fetchCategorias()
    }, [])

    async function fetchCategorias() {
        setLoading(true)
        try {
            const res = await fetch('/api/gastos/categorias')
            const data = await res.json()
            setCategorias(Array.isArray(data) ? data : [])
        } catch {
            toast.error('Error al cargar categorías')
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(cat: CategoriaGasto) {
        setForm({
            id: cat.id,
            nombre: cat.nombre,
            color: cat.color || '#E74C3C'
        })
        setEditMode(true)
        setShowModal(true)
    }

    function handleNew() {
        setForm({
            id: '',
            nombre: '',
            color: '#E74C3C'
        })
        setEditMode(false)
        setShowModal(true)
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)

        const url = editMode ? `/api/gastos/categorias/${form.id}` : `/api/gastos/categorias`
        const method = editMode ? 'PUT' : 'POST'

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: form.nombre,
                    color: form.color
                })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Error al guardar categoría')
            
            toast.success(editMode ? 'Categoría actualizada' : 'Categoría creada')
            setShowModal(false)
            fetchCategorias()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta categoría? Si tiene gastos asignados, se ocultará en nuevos formularios pero se mantendrá su historial.')) return

        setLoading(true)
        try {
            const res = await fetch(`/api/gastos/categorias/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Error al eliminar')
            toast.success('Categoría eliminada')
            fetchCategorias()
        } catch {
            toast.error('Error al intentar eliminar')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page-content">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configuración de Gastos</h1>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Administra los tipos de gastos disponibles en el sistema.</p>
                </div>
                <div className="page-actions">
                    <Link href="/costos" className="btn btn-ghost">← Volver a Costos</Link>
                    <button className="btn btn-primary" onClick={handleNew}>+ Nueva Categoría</button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Tipos de Gastos</h2>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Atributo</th>
                                <th>Nombre de la Categoría</th>
                                <th>Tipo Operativo</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center" style={{ padding: '2rem' }}>Cargando...</td>
                                </tr>
                            ) : categorias.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center" style={{ padding: '2rem' }}>No hay categorías registradas.</td>
                                </tr>
                            ) : (
                                categorias.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ width: '60px' }}>
                                            <div 
                                                style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: c.color || '#E74C3C', border: '1px solid var(--color-gray-200)' }} 
                                                title={c.color || '#E74C3C'}
                                            />
                                        </td>
                                        <td style={{ fontWeight: 'bold' }}>{c.nombre}</td>
                                        <td>
                                            <span className={`badge badge-${c.esOperativo ? 'success' : 'warning'}`}>
                                                {c.esOperativo ? 'Costos Puros' : 'Movi. General'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(c)}>Editar</button>
                                            <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Crear / Editar */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2>{editMode ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre del gasto</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={form.nombre} 
                                        onChange={e => setForm({ ...form, nombre: e.target.value })} 
                                        placeholder="Ej: Combustibles, Comida..."
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Color de Etiqueta</label>
                                    <input 
                                        type="color" 
                                        className="form-input" 
                                        style={{ padding: '0 4px', height: 40, cursor: 'pointer' }} 
                                        value={form.color} 
                                        onChange={e => setForm({ ...form, color: e.target.value })} 
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
