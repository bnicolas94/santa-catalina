"use client"

import { useState, useEffect } from 'react'

interface Area {
    id: string
    nombre: string
    descripcion: string | null
    color: string | null
    activo: boolean
    parentId: string | null
    responsableId: string | null
    responsable: { id: string; nombre: string; apellido: string | null } | null
    parent: { id: string; nombre: string } | null
    children: { id: string; nombre: string; color: string | null; activo: boolean }[]
    puestos: Puesto[]
    _count: { empleados: number }
}

interface Puesto {
    id: string
    nombre: string
    descripcion: string | null
    nivelJerarquico: number
    areaId: string
    _count: { empleados: number }
}

interface OrganigramaModalProps {
    onClose: () => void
    empleados: { id: string; nombre: string; apellido?: string | null }[]
    onChanged?: () => void
}

const AREA_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
]

export default function OrganigramaModal({ onClose, empleados, onChanged }: OrganigramaModalProps) {
    const [areas, setAreas] = useState<Area[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'tree' | 'list'>('tree')
    const [editArea, setEditArea] = useState<Partial<Area> | null>(null)
    const [editPuesto, setEditPuesto] = useState<Partial<Puesto> | null>(null)
    const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())

    useEffect(() => { fetchAreas() }, [])

    const fetchAreas = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/areas')
            const data = await res.json()
            setAreas(data)
            // Auto-expand all on first load
            setExpandedAreas(new Set(data.map((a: Area) => a.id)))
        } catch (err) {
            console.error('Error fetching areas:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpand = (id: string) => {
        setExpandedAreas(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ─── CRUD Áreas ──────────────────────────────────────────────────────────

    const handleSaveArea = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editArea?.nombre) return

        try {
            const method = editArea.id ? 'PUT' : 'POST'
            const res = await fetch('/api/areas', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editArea)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar área')
            }

            setEditArea(null)
            fetchAreas()
            onChanged?.()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const handleDeleteArea = async (id: string) => {
        if (!confirm('¿Desactivar esta área? Los empleados deberán ser reasignados.')) return
        try {
            const res = await fetch(`/api/areas?id=${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            fetchAreas()
            onChanged?.()
        } catch (err: any) {
            alert(err.message)
        }
    }

    // ─── CRUD Puestos ────────────────────────────────────────────────────────

    const handleSavePuesto = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editPuesto?.nombre || !editPuesto?.areaId) return

        try {
            const method = editPuesto.id ? 'PUT' : 'POST'
            const res = await fetch('/api/puestos', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editPuesto)
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar puesto')
            }

            setEditPuesto(null)
            fetchAreas()
            onChanged?.()
        } catch (err: any) {
            alert(err.message)
        }
    }

    const handleDeletePuesto = async (id: string) => {
        if (!confirm('¿Desactivar este puesto?')) return
        try {
            const res = await fetch(`/api/puestos?id=${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            fetchAreas()
            onChanged?.()
        } catch (err: any) {
            alert(err.message)
        }
    }

    // ─── Render Helper: Área Card ─────────────────────────────────────────────

    const renderAreaCard = (area: Area, depth: number = 0) => {
        const isExpanded = expandedAreas.has(area.id)
        const childAreas = areas.filter(a => a.parentId === area.id && a.activo)
        const areaColor = area.color || AREA_COLORS[areas.indexOf(area) % AREA_COLORS.length]

        return (
            <div key={area.id} style={{ marginLeft: depth * 24, marginBottom: 'var(--space-3)' }}>
                <div style={{
                    border: `2px solid ${areaColor}`,
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                    boxShadow: 'var(--shadow-sm)',
                }}>
                    {/* Header del Área */}
                    <div
                        onClick={() => toggleExpand(area.id)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: `${areaColor}10`,
                            borderBottom: isExpanded ? `1px solid ${areaColor}30` : 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{
                                width: 12, height: 12, borderRadius: '50%',
                                backgroundColor: areaColor
                            }} />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                                    {isExpanded ? '▼' : '▶'} {area.nombre}
                                </div>
                                {area.descripcion && (
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginTop: 2 }}>
                                        {area.descripcion}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {area.responsable && (
                                <span style={{
                                    fontSize: 'var(--text-xs)', padding: '2px 8px',
                                    backgroundColor: `${areaColor}20`, borderRadius: 'var(--radius-sm)',
                                    color: areaColor, fontWeight: 600
                                }}>
                                    👤 {area.responsable.nombre} {area.responsable.apellido || ''}
                                </span>
                            )}
                            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                {area._count.empleados} emp.
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setEditArea(area) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                title="Editar área"
                            >✏️</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteArea(area.id) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                title="Desactivar área"
                            >🗑️</button>
                        </div>
                    </div>

                    {/* Puestos del Área */}
                    {isExpanded && (
                        <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            {area.puestos.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {area.puestos.map(puesto => (
                                        <div key={puesto.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-gray-50)',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-gray-200)',
                                            fontSize: 'var(--text-sm)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                                                    backgroundColor: `${areaColor}15`, color: areaColor,
                                                    fontSize: '10px', fontWeight: 700,
                                                }}>
                                                    N{puesto.nivelJerarquico}
                                                </span>
                                                <span style={{ fontWeight: 600 }}>{puesto.nombre}</span>
                                                {puesto.descripcion && (
                                                    <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-xs)' }}>
                                                        — {puesto.descripcion}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                    {puesto._count.empleados} emp.
                                                </span>
                                                <button
                                                    onClick={() => setEditPuesto({ ...puesto })}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                                >✏️</button>
                                                <button
                                                    onClick={() => handleDeletePuesto(puesto.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                                                >🗑️</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                                    Sin puestos definidos
                                </div>
                            )}
                            <button
                                onClick={() => setEditPuesto({ nombre: '', areaId: area.id, nivelJerarquico: 0 })}
                                style={{
                                    marginTop: 'var(--space-2)', width: '100%',
                                    padding: 'var(--space-1)', fontSize: 'var(--text-xs)',
                                    background: 'none', border: `1px dashed ${areaColor}50`,
                                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    color: areaColor, fontWeight: 600,
                                }}
                            >
                                + Agregar Puesto
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub-áreas */}
                {isExpanded && childAreas.map(child => renderAreaCard(child, depth + 1))}
            </div>
        )
    }

    // ─── Stats ───────────────────────────────────────────────────────────────

    const totalAreas = areas.filter(a => a.activo).length
    const totalPuestos = areas.reduce((acc, a) => acc + a.puestos.length, 0)
    const totalAsignados = areas.reduce((acc, a) => acc + a._count.empleados, 0)

    // Top-level areas (no parent or parent is inactive)
    const rootAreas = areas.filter(a => a.activo && !a.parentId)

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: 'var(--radius-xl)',
                width: '95%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: 'var(--shadow-2xl)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: 'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--color-gray-200)',
                }}>
                    <div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            🏢 Organigrama
                        </h2>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                            Estructura organizacional — Áreas, Puestos y Jerarquías
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--color-gray-400)' }}
                    >×</button>
                </div>

                {/* Stats Row */}
                <div style={{
                    display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-6)',
                    backgroundColor: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{totalAreas}</span>
                        <span style={{ color: 'var(--color-gray-500)' }}>Áreas</span>
                    </div>
                    <div style={{ width: 1, backgroundColor: 'var(--color-gray-300)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-info)' }}>{totalPuestos}</span>
                        <span style={{ color: 'var(--color-gray-500)' }}>Puestos</span>
                    </div>
                    <div style={{ width: 1, backgroundColor: 'var(--color-gray-300)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>{totalAsignados}</span>
                        <span style={{ color: 'var(--color-gray-500)' }}>Asignados</span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setEditArea({ nombre: '', descripcion: '', color: AREA_COLORS[totalAreas % AREA_COLORS.length] })}
                    >
                        + Nueva Área
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4) var(--space-6)' }}>
                    {/* Formulario de Área */}
                    {editArea && (
                        <form onSubmit={handleSaveArea} style={{
                            marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
                            border: '2px solid var(--color-primary)', borderRadius: 'var(--radius-lg)',
                            backgroundColor: 'var(--color-info-bg)',
                        }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>
                                {editArea.id ? '✏️ Editar Área' : '🆕 Nueva Área'}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Nombre *</label>
                                    <input className="form-input" value={editArea.nombre || ''} onChange={e => setEditArea({ ...editArea, nombre: e.target.value })} required placeholder="Ej: Producción" />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Color</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                        {AREA_COLORS.map(c => (
                                            <button key={c} type="button" onClick={() => setEditArea({ ...editArea, color: c })} style={{
                                                width: 24, height: 24, borderRadius: '50%', backgroundColor: c,
                                                border: editArea.color === c ? '3px solid #333' : '2px solid transparent',
                                                cursor: 'pointer',
                                            }} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Descripción</label>
                                    <input className="form-input" value={editArea.descripcion || ''} onChange={e => setEditArea({ ...editArea, descripcion: e.target.value })} placeholder="Opcional" />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Área Padre</label>
                                    <select className="form-select" value={editArea.parentId || ''} onChange={e => setEditArea({ ...editArea, parentId: e.target.value || null })}>
                                        <option value="">— Raíz (sin padre) —</option>
                                        {areas.filter(a => a.activo && a.id !== editArea.id).map(a => (
                                            <option key={a.id} value={a.id}>{a.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Responsable</label>
                                    <select className="form-select" value={editArea.responsableId || ''} onChange={e => setEditArea({ ...editArea, responsableId: e.target.value || null })}>
                                        <option value="">— Sin responsable —</option>
                                        {empleados.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellido || ''}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                                <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditArea(null)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {/* Formulario de Puesto */}
                    {editPuesto && (
                        <form onSubmit={handleSavePuesto} style={{
                            marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
                            border: '2px solid var(--color-info)', borderRadius: 'var(--radius-lg)',
                            backgroundColor: '#F0F9FF',
                        }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>
                                {editPuesto.id ? '✏️ Editar Puesto' : '🆕 Nuevo Puesto'}
                                {editPuesto.areaId && (
                                    <span style={{ fontWeight: 400, color: 'var(--color-gray-500)', marginLeft: 'var(--space-2)' }}>
                                        en {areas.find(a => a.id === editPuesto.areaId)?.nombre || 'área'}
                                    </span>
                                )}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Nombre *</label>
                                    <input className="form-input" value={editPuesto.nombre || ''} onChange={e => setEditPuesto({ ...editPuesto, nombre: e.target.value })} required placeholder="Ej: Operario de Línea" />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Nivel Jerárquico</label>
                                    <input className="form-input" type="number" min="0" max="10" value={editPuesto.nivelJerarquico || 0} onChange={e => setEditPuesto({ ...editPuesto, nivelJerarquico: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Área</label>
                                    <select className="form-select" value={editPuesto.areaId || ''} onChange={e => setEditPuesto({ ...editPuesto, areaId: e.target.value })} required>
                                        <option value="">Seleccionar...</option>
                                        {areas.filter(a => a.activo).map(a => (
                                            <option key={a.id} value={a.id}>{a.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                                <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditPuesto(null)}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {/* Tree View */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" style={{ margin: '0 auto' }} />
                        </div>
                    ) : rootAreas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-gray-400)' }}>
                            <p style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🏢</p>
                            <p>No hay áreas definidas aún.</p>
                            <p style={{ fontSize: 'var(--text-sm)' }}>Comienza creando tu primera área organizacional.</p>
                        </div>
                    ) : (
                        <div>
                            {rootAreas.map(area => renderAreaCard(area))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: 'var(--space-3) var(--space-6)',
                    borderTop: '1px solid var(--color-gray-200)',
                    display: 'flex', justifyContent: 'flex-end',
                }}>
                    <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    )
}
