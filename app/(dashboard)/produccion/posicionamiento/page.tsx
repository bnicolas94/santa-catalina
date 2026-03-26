'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Concepto {
    id: string
    nombre: string
    descripcion: string | null
}

interface Empleado {
    id: string
    nombre: string
    apellido: string | null
    rol: string
}

interface Asignacion {
    id?: string
    empleadoId: string
    conceptoId: string
    observaciones?: string
    empleado?: { nombre: string, apellido: string | null }
}

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

export default function PosicionamientoPage() {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
    const [turno, setTurno] = useState('AM')
    const [roles, setRoles] = useState<{ id: string, nombre: string }[]>([])
    const [selectedRole, setSelectedRole] = useState('OPERARIO')
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
    const [ubicacionId, setUbicacionId] = useState('')
    const [conceptos, setConceptos] = useState<Concepto[]>([])
    const [operarios, setOperarios] = useState<Empleado[]>([])
    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    // Conceptos CRUD Modal
    const [showConceptoModal, setShowConceptoModal] = useState(false)
    const [nuevoConcepto, setNuevoConcepto] = useState({ nombre: '', descripcion: '' })

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (ubicacionId && fecha) {
            fetchPosicionamiento()
        }
    }, [ubicacionId, fecha, turno])

    async function fetchInitialData() {
        try {
            const [ubiRes, conceptRes, empRes, rolesRes] = await Promise.all([
                fetch('/api/ubicaciones'),
                fetch('/api/produccion/conceptos'),
                fetch('/api/empleados'),
                fetch('/api/empleados/roles')
            ])
            const ubiData = await ubiRes.json()
            const conceptData = await conceptRes.json()
            const empData = await empRes.json()
            const rolesData = await rolesRes.json()

            const validUbi = Array.isArray(ubiData) ? ubiData : []
            setUbicaciones(validUbi)
            setConceptos(Array.isArray(conceptData) ? conceptData : [])
            setRoles(Array.isArray(rolesData) ? rolesData : [])
            
            // Default location
            if (validUbi.length > 0) {
                const def = validUbi.find(u => u.tipo === 'FABRICA') || validUbi[0]
                setUbicacionId(def.id)
            }

            // Operarios (solo rol OPERARIO o similar si se desea)
            const ops = Array.isArray(empData) ? empData.filter(e => e.activo) : []
            setOperarios(ops)

        } catch (err) {
            setError('Error al cargar datos iniciales')
        } finally {
            setLoading(false)
        }
    }

    async function fetchPosicionamiento() {
        try {
            const res = await fetch(`/api/produccion/posicionamiento?fecha=${fecha}&ubicacionId=${ubicacionId}&turno=${turno}`)
            const data = await res.json()
            setAsignaciones(Array.isArray(data) ? data : [])
        } catch (err) {
            setError('Error al cargar posicionamiento del día')
        }
    }

    // Filtrar operarios por ubicación seleccionada y rol
    const operariosFiltrados = operarios.filter(op => 
        (op as any).ubicacionId === ubicacionId && 
        op.rol === selectedRole
    )

    const handleAssign = (empleadoId: string, conceptoId: string) => {
        setAsignaciones(prev => {
            // Eliminar si ya estaba en otro concepto ese mismo empleado (un empleado solo puede estar en un lugar)
            const filtered = prev.filter(a => a.empleadoId !== empleadoId)
            if (conceptoId === 'none') return filtered
            return [...filtered, { empleadoId, conceptoId }]
        })
    }

    async function handleSave() {
        setSaving(true)
        setError('')
        try {
            const res = await fetch('/api/produccion/posicionamiento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    ubicacionId,
                    turno,
                    asignaciones: asignaciones.map(a => ({
                        empleadoId: a.empleadoId,
                        conceptoId: a.conceptoId,
                        observaciones: a.observaciones
                    }))
                })
            })
            if (!res.ok) throw new Error('Error al guardar')
            setSuccess('Posicionamiento guardado correctamente')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Error al guardar los cambios')
        } finally {
            setSaving(false)
        }
    }

    async function handleCreateConcepto(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await fetch('/api/produccion/conceptos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoConcepto)
            })
            if (!res.ok) throw new Error('Error al crear concepto')
            const data = await res.json()
            setConceptos(prev => [...prev, data])
            setNuevoConcepto({ nombre: '', descripcion: '' })
            setShowConceptoModal(false)
        } catch (err) {
            alert('Error al crear concepto')
        }
    }

    if (loading) return <div>Cargando...</div>

    return (
        <div className="container" style={{ padding: 'var(--space-6)' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1>📍 Posicionamiento Diario</h1>
                    <p style={{ color: 'var(--color-gray-500)' }}>Asigna operarios a sus estaciones de trabajo</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn btn-secondary" onClick={() => setShowConceptoModal(true)}>⚙️ Conceptos</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : '💾 Guardar Cambios'}
                    </button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Fecha</label>
                        <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Ubicación / Sucursal</label>
                        <select className="form-select" value={ubicacionId} onChange={e => setUbicacionId(e.target.value)}>
                            {ubicaciones.map(u => (
                                <option key={u.id} value={u.id}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Turno</label>
                        <div style={{ display: 'flex', gap: '2px', background: 'var(--color-gray-100)', padding: '2px', borderRadius: '6px' }}>
                            <button 
                                className={`btn btn-sm ${turno === 'AM' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTurno('AM')}
                                style={{ padding: '4px 12px' }}
                            >
                                AM
                            </button>
                            <button 
                                className={`btn btn-sm ${turno === 'PM' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTurno('PM')}
                                style={{ padding: '4px 12px' }}
                            >
                                PM
                            </button>
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Ver Rol</label>
                        <select 
                            className="form-select" 
                            value={selectedRole} 
                            onChange={e => setSelectedRole(e.target.value)}
                        >
                            {roles.map(r => (
                                <option key={r.id} value={r.nombre}>{r.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-6)' }}>
                {/* Panel lateral: Operarios */}
                <div className="card">
                    <div className="card-header">
                        <h3>Operarios ({operariosFiltrados.length})</h3>
                    </div>
                    <div className="card-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {operariosFiltrados.length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'var(--color-gray-400)', textAlign: 'center' }}>No hay operarios vinculados a esta ubicación.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {operariosFiltrados.map(op => {
                                    const asig = asignaciones.find(a => a.empleadoId === op.id)
                                    const conceptoAsig = conceptos.find(c => c.id === asig?.conceptoId)
                                    return (
                                        <div key={op.id} style={{ 
                                            padding: '8px', 
                                            borderRadius: '4px', 
                                            border: '1px solid var(--color-gray-200)',
                                            background: asig ? 'var(--color-primary-light)' : 'white'
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{op.nombre} {op.apellido}</div>
                                            <div style={{ fontSize: '11px', color: asig ? 'var(--color-primary)' : 'var(--color-gray-500)' }}>
                                                {asig ? `📍 ${conceptoAsig?.nombre}` : 'Sin asignar'}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Área central: Conceptos y Grilla de asignación */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', alignContent: 'start' }}>
                    {conceptos.map(concepto => (
                        <div key={concepto.id} className="card">
                            <div className="card-header" style={{ background: 'var(--color-gray-50)', padding: '10px 15px' }}>
                                <h4 style={{ margin: 0 }}>{concepto.nombre}</h4>
                            </div>
                            <div className="card-body" style={{ minHeight: '150px', padding: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {asignaciones.filter(a => a.conceptoId === concepto.id).map(asig => {
                                        const op = operarios.find(o => o.id === asig.empleadoId)
                                        return (
                                            <div key={asig.empleadoId} style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                padding: '6px 10px',
                                                background: 'var(--white)',
                                                border: '1px solid var(--color-gray-100)',
                                                borderRadius: '4px',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}>
                                                <span style={{ fontSize: '13px', fontWeight: 500 }}>{op?.nombre} {op?.apellido}</span>
                                                <button className="btn btn-xs btn-ghost" onClick={() => handleAssign(asig.empleadoId, 'none')}>✕</button>
                                            </div>
                                        )
                                    })}
                                    <select 
                                        className="form-select form-select-sm" 
                                        value="" 
                                        onChange={e => handleAssign(e.target.value, concepto.id)}
                                        style={{ marginTop: '8px' }}
                                    >
                                        <option value="">+ Añadir operario...</option>
                                        {operariosFiltrados
                                            .filter(op => !asignaciones.some(a => a.empleadoId === op.id))
                                            .map(op => (
                                                <option key={op.id} value={op.id}>{op.nombre} {op.apellido}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal de Conceptos */}
            {showConceptoModal && (
                <div className="modal-overlay" onClick={() => setShowConceptoModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Gestionar Conceptos</h2>
                            <button className="btn btn-ghost" onClick={() => setShowConceptoModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleCreateConcepto} style={{ marginBottom: '20px', padding: '15px', background: 'var(--color-gray-50)', borderRadius: '8px' }}>
                                <h4>Nuevo Concepto</h4>
                                <div className="form-group">
                                    <input 
                                        className="form-input" 
                                        placeholder="Nombre (ej: Línea 1)" 
                                        value={nuevoConcepto.nombre}
                                        onChange={e => setNuevoConcepto({...nuevoConcepto, nombre: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <input 
                                        className="form-input" 
                                        placeholder="Descripción (opcional)" 
                                        value={nuevoConcepto.descripcion}
                                        onChange={e => setNuevoConcepto({...nuevoConcepto, descripcion: e.target.value})}
                                    />
                                </div>
                                <button className="btn btn-sm btn-primary" type="submit">Agregar</button>
                            </form>

                            <div className="table-container">
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Concepto</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {conceptos.map(c => (
                                            <tr key={c.id}>
                                                <td>{c.nombre}</td>
                                                <td>
                                                    <button className="btn btn-xs btn-ghost" onClick={async () => {
                                                        if (confirm('¿Desactivar concepto?')) {
                                                            await fetch(`/api/produccion/conceptos/${c.id}`, { method: 'DELETE' })
                                                            setConceptos(prev => prev.filter(x => x.id !== c.id))
                                                        }
                                                    }}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
