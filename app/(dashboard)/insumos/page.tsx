'use client'

import { useState, useEffect } from 'react'

interface Proveedor {
    id: string
    nombre: string
}

interface Familia {
    id: string
    nombre: string
    color: string | null
    _count: { insumos: number }
}

interface Insumo {
    id: string
    nombre: string
    unidadMedida: string
    stockActual: number
    stockMinimo: number
    precioUnitario: number
    diasReposicion: number
    activo: boolean
    proveedor: Proveedor | null
    familia: Familia | null
    unidadSecundaria: string | null
    factorConversion: number | null
    stockActualSecundario: number
}

const UNIDADES = [
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'g', label: 'Gramos (g)' },
    { value: 'u', label: 'Unidades (u)' },
    { value: 'lt', label: 'Litros (lt)' },
]

const COLORES_FAMILIA = [
    '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
    '#3498DB', '#9B59B6', '#E91E63', '#795548', '#607D8B',
]

function getSemaforoEstado(stockActual: number, stockMinimo: number) {
    if (stockMinimo <= 0) return { clase: 'verde', label: 'OK' }
    if (stockActual < stockMinimo) return { clase: 'rojo', label: 'Bajo mínimo' }
    if (stockActual < stockMinimo * 2) return { clase: 'amarillo', label: 'Precaución' }
    return { clase: 'verde', label: 'OK' }
}

export default function InsumosPage() {
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [familias, setFamilias] = useState<Familia[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showFamiliaModal, setShowFamiliaModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingFamiliaId, setEditingFamiliaId] = useState<string | null>(null)
    const [filterEstado, setFilterEstado] = useState('')
    const [filterFamilia, setFilterFamilia] = useState('')
    const [form, setForm] = useState({
        nombre: '',
        unidadMedida: 'kg',
        stockActual: '',
        stockMinimo: '',
        precioUnitario: '',
        diasReposicion: '1',
        proveedorId: '',
        familiaId: '',
        unidadSecundaria: '',
        factorConversion: '',
    })
    const [familiaForm, setFamiliaForm] = useState({ nombre: '', color: COLORES_FAMILIA[0] })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [insRes, provRes, famRes] = await Promise.all([
                fetch('/api/insumos'),
                fetch('/api/proveedores'),
                fetch('/api/familias-insumo'),
            ])
            const insData = await insRes.json()
            const provData = await provRes.json()
            const famData = await famRes.json()
            setInsumos(Array.isArray(insData) ? insData : [])
            setProveedores(Array.isArray(provData) ? provData : [])
            setFamilias(Array.isArray(famData) ? famData : [])
        } catch {
            setError('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    function resetForm() {
        setEditingId(null)
        setForm({ 
            nombre: '', unidadMedida: 'kg', stockActual: '', stockMinimo: '', 
            precioUnitario: '', diasReposicion: '1', proveedorId: '', familiaId: '',
            unidadSecundaria: '', factorConversion: ''
        })
    }

    function openEdit(ins: Insumo) {
        setEditingId(ins.id)
        setForm({
            nombre: ins.nombre,
            unidadMedida: ins.unidadMedida,
            stockActual: String(ins.stockActual),
            stockMinimo: String(ins.stockMinimo),
            precioUnitario: String(ins.precioUnitario),
            diasReposicion: String(ins.diasReposicion),
            proveedorId: ins.proveedor?.id || '',
            familiaId: ins.familia?.id || '',
            unidadSecundaria: ins.unidadSecundaria || '',
            factorConversion: ins.factorConversion ? String(ins.factorConversion) : '',
        })
        setShowModal(true)
    }

    async function handleDelete(id: string, nombre: string) {
        console.log('Attempting to delete insumo:', id, nombre)
        if (!window.confirm(`¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
            console.log('Deletion cancelled by user')
            return
        }
        try {
            console.log('Sending DELETE request to /api/insumos/' + id)
            const res = await fetch(`/api/insumos/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar')
            }
            console.log('Delete successful')
            setSuccess('Insumo eliminado')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            console.error('Delete error:', err)
            setError(err instanceof Error ? err.message : 'Error al eliminar')
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        try {
            const url = editingId ? `/api/insumos/${editingId}` : '/api/insumos'
            const method = editingId ? 'PUT' : 'POST'

            // Handle commas for decimal values and normalize to dot
            const cleansedForm = {
                ...form,
                stockActual: form.stockActual.replace(',', '.'),
                stockMinimo: form.stockMinimo.replace(',', '.'),
                precioUnitario: form.precioUnitario.replace(',', '.'),
                factorConversion: form.factorConversion.replace(',', '.'),
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleansedForm),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar')
            }

            setSuccess(editingId ? 'Insumo actualizado' : 'Insumo creado exitosamente')
            setShowModal(false)
            resetForm()
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar')
        }
    }

    // ---- Familias CRUD ----
    function openEditFamilia(fam: Familia) {
        setEditingFamiliaId(fam.id)
        setFamiliaForm({ nombre: fam.nombre, color: fam.color || COLORES_FAMILIA[0] })
        setShowFamiliaModal(true)
    }

    async function handleFamiliaSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const url = editingFamiliaId ? `/api/familias-insumo/${editingFamiliaId}` : '/api/familias-insumo'
            const method = editingFamiliaId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(familiaForm),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al guardar')
            }
            setSuccess(editingFamiliaId ? 'Familia actualizada' : 'Familia creada')
            setShowFamiliaModal(false)
            setEditingFamiliaId(null)
            setFamiliaForm({ nombre: '', color: COLORES_FAMILIA[0] })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleDeleteFamilia(id: string, nombre: string) {
        if (!confirm(`¿Eliminar la familia "${nombre}"? Los insumos quedarán sin familia.`)) return
        try {
            await fetch(`/api/familias-insumo/${id}`, { method: 'DELETE' })
            setSuccess('Familia eliminada')
            if (filterFamilia === id) setFilterFamilia('')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch {
            setError('Error al eliminar familia')
        }
    }

    // ---- Filtrado ----
    const filteredInsumos = insumos.filter((ins) => {
        const estadoOk = !filterEstado || getSemaforoEstado(ins.stockActual, ins.stockMinimo).clase === filterEstado
        const familiaOk = !filterFamilia || (filterFamilia === '__sin__' ? !ins.familia : ins.familia?.id === filterFamilia)
        return estadoOk && familiaOk
    })

    const stats = {
        total: insumos.length,
        criticos: insumos.filter((i) => getSemaforoEstado(i.stockActual, i.stockMinimo).clase === 'rojo').length,
        precaucion: insumos.filter((i) => getSemaforoEstado(i.stockActual, i.stockMinimo).clase === 'amarillo').length,
        ok: insumos.filter((i) => getSemaforoEstado(i.stockActual, i.stockMinimo).clase === 'verde').length,
    }

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
                <p>Cargando inventario...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="page-header">
                <h1>📦 Insumos e Inventario</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button className="btn btn-outline" onClick={() => { setEditingFamiliaId(null); setFamiliaForm({ nombre: '', color: COLORES_FAMILIA[0] }); setShowFamiliaModal(true) }}>
                        🏷️ Gestionar Familias
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
                        + Nuevo Insumo
                    </button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Familias como badges + filtro */}
            {familias.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 700, fontFamily: 'var(--font-ui)', textTransform: 'uppercase', marginRight: 'var(--space-2)' }}>Familias:</span>
                    <button
                        className={`btn btn-sm ${filterFamilia === '' ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => setFilterFamilia('')}
                        style={{ fontSize: 'var(--text-xs)' }}
                    >
                        Todas
                    </button>
                    {familias.map((fam) => {
                        const c = fam.color || '#607D8B'
                        const isActive = filterFamilia === fam.id
                        return (
                            <button
                                key={fam.id}
                                className="btn btn-sm"
                                onClick={() => setFilterFamilia(isActive ? '' : fam.id)}
                                style={{
                                    fontSize: 'var(--text-xs)',
                                    backgroundColor: isActive ? c : `${c}18`,
                                    color: isActive ? '#fff' : c,
                                    border: `2px solid ${c}`,
                                    fontWeight: 600,
                                }}
                            >
                                {fam.nombre} ({fam._count.insumos})
                            </button>
                        )
                    })}
                    <button
                        className={`btn btn-sm ${filterFamilia === '__sin__' ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => setFilterFamilia(filterFamilia === '__sin__' ? '' : '__sin__')}
                        style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic' }}
                    >
                        Sin familia
                    </button>
                </div>
            )}

            {/* Stats de semáforo */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <button
                    className={`btn ${filterEstado === '' ? 'btn-secondary' : 'btn-ghost'} btn-sm`}
                    onClick={() => setFilterEstado('')}
                >
                    Todos ({stats.total})
                </button>
                <button
                    className={`btn ${filterEstado === 'rojo' ? 'btn-danger' : 'btn-ghost'} btn-sm`}
                    onClick={() => setFilterEstado(filterEstado === 'rojo' ? '' : 'rojo')}
                >
                    🔴 Bajo mínimo ({stats.criticos})
                </button>
                <button
                    className={`btn ${filterEstado === 'amarillo' ? 'btn-outline' : 'btn-ghost'} btn-sm`}
                    onClick={() => setFilterEstado(filterEstado === 'amarillo' ? '' : 'amarillo')}
                    style={filterEstado === 'amarillo' ? { borderColor: 'var(--color-warning)', color: 'var(--color-warning)' } : {}}
                >
                    🟡 Precaución ({stats.precaucion})
                </button>
                <button
                    className={`btn ${filterEstado === 'verde' ? 'btn-outline' : 'btn-ghost'} btn-sm`}
                    onClick={() => setFilterEstado(filterEstado === 'verde' ? '' : 'verde')}
                    style={filterEstado === 'verde' ? { borderColor: 'var(--color-success)', color: 'var(--color-success)' } : {}}
                >
                    🟢 OK ({stats.ok})
                </button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Estado</th>
                            <th>Insumo</th>
                            <th>Familia</th>
                            <th>Stock Actual</th>
                            <th>Stock Mínimo</th>
                            <th>Precio Unit.</th>
                            <th>Proveedor</th>
                            <th>Reposición</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInsumos.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No hay insumos registrados
                                </td>
                            </tr>
                        ) : (
                            filteredInsumos.map((ins) => {
                                const estado = getSemaforoEstado(ins.stockActual, ins.stockMinimo)
                                return (
                                    <tr key={ins.id}>
                                        <td>
                                            <div className="semaforo">
                                                <span className={`semaforo-dot ${estado.clase}`} />
                                                <span style={{ fontSize: 'var(--text-xs)' }}>{estado.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{ins.nombre}</td>
                                        <td>
                                            {ins.familia ? (
                                                <span className="badge" style={{
                                                    backgroundColor: `${ins.familia.color || '#607D8B'}20`,
                                                    color: ins.familia.color || '#607D8B',
                                                    border: `1px solid ${ins.familia.color || '#607D8B'}40`,
                                                }}>
                                                    {ins.familia.nombre}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-sm)' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            <div>{ins.stockActual.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {ins.unidadMedida}</div>
                                            {ins.unidadSecundaria && (
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                    {ins.stockActualSecundario.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {ins.unidadSecundaria}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {ins.stockMinimo.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {ins.unidadMedida}
                                        </td>
                                        <td>${ins.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}/{ins.unidadMedida}</td>
                                        <td>{ins.proveedor?.nombre || '—'}</td>
                                        <td>{ins.diasReposicion} días</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ins)}>
                                                    Editar
                                                </button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(ins.id, ins.nombre)}>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Insumo */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Editar Insumo' : 'Nuevo Insumo'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre del insumo</label>
                                    <input
                                        className="form-input"
                                        value={form.nombre}
                                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                        required
                                        placeholder="Ej: Pan lactal, Jamón cocido"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Unidad de medida</label>
                                        <select
                                            className="form-select"
                                            value={form.unidadMedida}
                                            onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
                                        >
                                            {UNIDADES.map((u) => (
                                                <option key={u.value} value={u.value}>{u.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Familia</label>
                                        <select
                                            className="form-select"
                                            value={form.familiaId}
                                            onChange={(e) => setForm({ ...form, familiaId: e.target.value })}
                                        >
                                            <option value="">Sin familia</option>
                                            {familias.map((f) => (
                                                <option key={f.id} value={f.id}>{f.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Precio unitario ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={form.precioUnitario}
                                            onChange={(e) => setForm({ ...form, precioUnitario: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Días de reposición</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={form.diasReposicion}
                                            onChange={(e) => setForm({ ...form, diasReposicion: e.target.value })}
                                            placeholder="1"
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Stock actual</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={form.stockActual}
                                            onChange={(e) => setForm({ ...form, stockActual: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Stock mínimo</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={form.stockMinimo}
                                            onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                    <h4 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--color-gray-500)' }}>Unidad Secundaria (Opcional)</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Nombre unidad</label>
                                            <input
                                                className="form-input"
                                                value={form.unidadSecundaria}
                                                onChange={(e) => setForm({ ...form, unidadSecundaria: e.target.value })}
                                                placeholder="Ej: Barra, Cajón"
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Equivalencia (1 {form.unidadSecundaria || 'u'} = ? {form.unidadMedida})</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                className="form-input"
                                                value={form.factorConversion}
                                                onChange={(e) => setForm({ ...form, factorConversion: e.target.value })}
                                                placeholder="Ej: 5 (si 1 barra = 5kg)"
                                            />
                                            <p style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '4px' }}>Dejar vacío si el peso es variable</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Proveedor</label>
                                    <select
                                        className="form-select"
                                        value={form.proveedorId}
                                        onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
                                    >
                                        <option value="">Sin proveedor</option>
                                        {proveedores.map((p) => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Guardar cambios' : 'Crear insumo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Familias */}
            {showFamiliaModal && (
                <div className="modal-overlay" onClick={() => setShowFamiliaModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2>🏷️ Familias de Insumos</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowFamiliaModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Lista de familias existentes */}
                            {familias.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    {familias.map((fam) => (
                                        <div key={fam.id} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: 'var(--space-3) var(--space-4)',
                                            borderBottom: '1px solid var(--color-gray-100)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <span style={{
                                                    width: 12, height: 12, borderRadius: '50%',
                                                    backgroundColor: fam.color || '#607D8B',
                                                    display: 'inline-block', flexShrink: 0,
                                                }} />
                                                <span style={{ fontWeight: 600 }}>{fam.nombre}</span>
                                                <span style={{ color: 'var(--color-gray-400)', fontSize: 'var(--text-xs)' }}>
                                                    {fam._count.insumos} insumos
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEditFamilia(fam)}>Editar</button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteFamilia(fam.id, fam.nombre)}>Eliminar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Formulario crear/editar familia */}
                            <form onSubmit={handleFamiliaSubmit}>
                                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                                    <h4 style={{ marginBottom: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>
                                        {editingFamiliaId ? 'Editar familia' : 'Nueva familia'}
                                    </h4>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label className="form-label">Nombre</label>
                                            <input
                                                className="form-input"
                                                value={familiaForm.nombre}
                                                onChange={(e) => setFamiliaForm({ ...familiaForm, nombre: e.target.value })}
                                                required
                                                placeholder="Ej: Fiambres, Verduras, Panificados"
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0, width: 60 }}>
                                            <label className="form-label">Color</label>
                                            <input
                                                type="color"
                                                value={familiaForm.color}
                                                onChange={(e) => setFamiliaForm({ ...familiaForm, color: e.target.value })}
                                                style={{ width: '100%', height: 38, padding: 2, cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-gray-200)' }}
                                            />
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-sm" style={{ height: 38, whiteSpace: 'nowrap' }}>
                                            {editingFamiliaId ? 'Guardar' : '+ Crear'}
                                        </button>
                                        {editingFamiliaId && (
                                            <button type="button" className="btn btn-ghost btn-sm" style={{ height: 38 }} onClick={() => { setEditingFamiliaId(null); setFamiliaForm({ nombre: '', color: COLORES_FAMILIA[0] }) }}>
                                                Cancelar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
