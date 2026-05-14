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
        stockActualSecundario: '',
    })
    const [familiaForm, setFamiliaForm] = useState({ nombre: '', color: COLORES_FAMILIA[0] })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [historialInsumoId, setHistorialInsumoId] = useState<string | null>(null)

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
            unidadSecundaria: '', factorConversion: '', stockActualSecundario: ''
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
            stockActualSecundario: ins.stockActualSecundario ? String(ins.stockActualSecundario) : '',
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
                stockActualSecundario: form.stockActualSecundario.replace(',', '.'),
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
                                                <button className="btn btn-ghost btn-sm" onClick={() => setHistorialInsumoId(ins.id)} title="Ver historial">
                                                    📊
                                                </button>
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
                                            onChange={(e) => {
                                                const val = e.target.value
                                                const factor = parseFloat(form.factorConversion.replace(',', '.'))
                                                const newSec = (val && factor && factor > 0) ? (parseFloat(val.replace(',', '.')) / factor).toFixed(2) : form.stockActualSecundario
                                                setForm({ ...form, stockActual: val, stockActualSecundario: String(newSec) })
                                            }}
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
                                                onChange={(e) => {
                                                    const factorStr = e.target.value
                                                    const factor = parseFloat(factorStr.replace(',', '.'))
                                                    const stockPrim = parseFloat(form.stockActual.replace(',', '.'))
                                                    const newSec = (stockPrim && factor && factor > 0) ? (stockPrim / factor).toFixed(2) : form.stockActualSecundario
                                                    setForm({ ...form, factorConversion: factorStr, stockActualSecundario: String(newSec) })
                                                }}
                                                placeholder="Ej: 5 (si 1 barra = 5kg)"
                                            />
                                            <p style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '4px' }}>Dejar vacío si el peso es variable</p>
                                        </div>
                                    </div>
                                    
                                    {form.unidadSecundaria && (
                                        <div className="form-group" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
                                            <label className="form-label">Stock actual en {form.unidadSecundaria}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="form-input"
                                                value={form.stockActualSecundario}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    const factor = parseFloat(form.factorConversion.replace(',', '.'))
                                                    const newPrim = (val && factor && factor > 0) ? (parseFloat(val.replace(',', '.')) * factor).toFixed(2) : form.stockActual
                                                    setForm({ ...form, stockActualSecundario: val, stockActual: String(newPrim) })
                                                }}
                                                placeholder="0"
                                                style={{ backgroundColor: '#fff', fontWeight: 600, color: 'var(--color-primary)' }}
                                            />
                                            <p style={{ fontSize: '10px', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                                💡 Al modificar este valor, se calculará automáticamente el <strong>Stock Actual</strong> (arriba).
                                            </p>
                                        </div>
                                    )}
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
            {/* Modal Historial Insumo */}
            {historialInsumoId && (
                <HistorialInsumoModal
                    insumoId={historialInsumoId}
                    onClose={() => setHistorialInsumoId(null)}
                />
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
// MODAL: Historial completo de un insumo
// ═══════════════════════════════════════════════════════════════
function HistorialInsumoModal({ insumoId, onClose }: { insumoId: string; onClose: () => void }) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [filtro, setFiltro] = useState('')
    const [soloEntradas, setSoloEntradas] = useState(false)

    // Date filter state
    const [fechaDesde, setFechaDesde] = useState('')
    const [fechaHasta, setFechaHasta] = useState('')
    const [presetActivo, setPresetActivo] = useState('todo')

    function aplicarPreset(preset: string) {
        const hoy = new Date()
        let desde = ''
        let hasta = ''

        switch (preset) {
            case 'mes': {
                const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
                desde = inicio.toISOString().split('T')[0]
                hasta = hoy.toISOString().split('T')[0]
                break
            }
            case 'mes_ant': {
                const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
                const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
                desde = inicio.toISOString().split('T')[0]
                hasta = fin.toISOString().split('T')[0]
                break
            }
            case '3meses': {
                const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
                desde = inicio.toISOString().split('T')[0]
                hasta = hoy.toISOString().split('T')[0]
                break
            }
            case 'anio': {
                const inicio = new Date(hoy.getFullYear(), 0, 1)
                desde = inicio.toISOString().split('T')[0]
                hasta = hoy.toISOString().split('T')[0]
                break
            }
            case 'todo':
            default:
                desde = ''
                hasta = ''
                break
        }

        setPresetActivo(preset)
        setFechaDesde(desde)
        setFechaHasta(hasta)
    }

    useEffect(() => {
        async function fetchHistorial() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (fechaDesde) params.set('desde', new Date(fechaDesde + 'T00:00:00').toISOString())
                if (fechaHasta) params.set('hasta', new Date(fechaHasta + 'T23:59:59').toISOString())
                const qs = params.toString() ? `?${params.toString()}` : ''
                const res = await fetch(`/api/insumos/${insumoId}/historial${qs}`)
                if (res.ok) setData(await res.json())
            } catch (err) {
                console.error('Error fetching historial:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchHistorial()
    }, [insumoId, fechaDesde, fechaHasta])

    const formatCurrency = (v: number) => '$' + Math.round(v).toLocaleString('es-AR')
    const formatCurrencyDec = (v: number) => '$' + v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const formatNum = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 2 })

    const filteredMovimientos = data?.movimientos?.filter((m: any) => {
        if (soloEntradas && m.tipo !== 'entrada') return false
        if (!filtro) return true
        const lower = filtro.toLowerCase()
        return m.proveedor.toLowerCase().includes(lower) ||
            m.factura.toLowerCase().includes(lower) ||
            m.observaciones.toLowerCase().includes(lower)
    }) || []

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1000, width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
                            📊 Historial: {data?.insumo?.nombre || 'Cargando...'}
                            {data?.insumo?.familia && (
                                <span className="badge" style={{
                                    backgroundColor: `${data.insumo.familia.color || '#607D8B'}20`,
                                    color: data.insumo.familia.color || '#607D8B',
                                    fontSize: 'var(--text-xs)'
                                }}>
                                    {data.insumo.familia.nombre}
                                </span>
                            )}
                        </h2>
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                    </div>

                    {/* Date filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {[
                            { key: 'mes', label: 'Este mes' },
                            { key: 'mes_ant', label: 'Mes anterior' },
                            { key: '3meses', label: 'Últimos 3 meses' },
                            { key: 'anio', label: 'Este año' },
                            { key: 'todo', label: 'Todo' },
                        ].map(p => (
                            <button
                                key={p.key}
                                className={`btn btn-sm ${presetActivo === p.key ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => aplicarPreset(p.key)}
                                style={{ fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}
                            >
                                {p.label}
                            </button>
                        ))}
                        <span style={{ color: 'var(--color-gray-300)', margin: '0 4px' }}>|</span>
                        <input
                            type="date"
                            className="form-input"
                            value={fechaDesde}
                            onChange={e => { setFechaDesde(e.target.value); setPresetActivo('') }}
                            style={{ fontSize: 'var(--text-xs)', padding: '4px 6px', width: 130 }}
                        />
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)' }}>a</span>
                        <input
                            type="date"
                            className="form-input"
                            value={fechaHasta}
                            onChange={e => { setFechaHasta(e.target.value); setPresetActivo('') }}
                            style={{ fontSize: 'var(--text-xs)', padding: '4px 6px', width: 130 }}
                        />
                    </div>
                </div>

                <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
                    {loading ? (
                        <div className="empty-state"><div className="spinner" /><p>Cargando historial...</p></div>
                    ) : !data ? (
                        <div className="empty-state"><p>Error al cargar</p></div>
                    ) : (
                        <>
                            {/* KPIs */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: 'var(--space-3)',
                                marginBottom: 'var(--space-6)'
                            }}>
                                {[
                                    { label: 'Total Gastado', value: formatCurrency(data.resumen.totalGastado), color: 'var(--color-danger)' },
                                    { label: 'Cant. Comprada', value: `${formatNum(data.resumen.totalCantidadComprada)} ${data.insumo.unidadMedida}`, color: 'var(--color-info)' },
                                    { label: 'Precio Prom.', value: formatCurrencyDec(data.resumen.precioPromedio) + '/' + data.insumo.unidadMedida, color: 'var(--color-warning)' },
                                    { label: 'Precio Actual', value: formatCurrencyDec(data.resumen.precioActual) + '/' + data.insumo.unidadMedida, color: 'var(--color-primary)' },
                                    { label: 'Facturas', value: String(data.resumen.totalFacturas), color: 'var(--color-secondary)' },
                                    { label: 'Movimientos', value: String(data.resumen.totalMovimientos), color: 'var(--color-gray-500)' },
                                ].map((kpi, i) => (
                                    <div key={i} style={{
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--color-gray-100)',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>{kpi.label}</div>
                                        <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Gasto mensual - barras simples */}
                            {data.gastoMensual.some((m: any) => m.gasto > 0) && (
                                <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                                    <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Gasto Mensual (12 meses)
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                                        {(() => {
                                            const maxGasto = Math.max(...data.gastoMensual.map((m: any) => m.gasto), 1)
                                            return data.gastoMensual.map((m: any, i: number) => (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: `${Math.max((m.gasto / maxGasto) * 100, m.gasto > 0 ? 4 : 0)}px`,
                                                            backgroundColor: m.gasto > 0 ? '#E74C3C' : 'var(--color-gray-200)',
                                                            borderRadius: '4px 4px 0 0',
                                                            transition: 'height 0.3s ease'
                                                        }}
                                                        title={`${m.label}: ${formatCurrency(m.gasto)}`}
                                                    />
                                                    <span style={{ fontSize: '9px', color: 'var(--color-gray-400)', marginTop: 2 }}>{m.label}</span>
                                                </div>
                                            ))
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Evolución de precios */}
                            {data.evolucionPrecios.length > 1 && (
                                <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                                    <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Evolución de Precio por {data.insumo.unidadMedida}
                                    </h4>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                                        {(() => {
                                            const precios = data.evolucionPrecios.slice(-20)
                                            const maxP = Math.max(...precios.map((p: any) => p.precioUnitario), 1)
                                            const minP = Math.min(...precios.map((p: any) => p.precioUnitario))
                                            return precios.map((p: any, i: number) => (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: `${Math.max(((p.precioUnitario - minP * 0.8) / (maxP - minP * 0.8 + 0.01)) * 70, 4)}px`,
                                                            backgroundColor: i === precios.length - 1 ? '#3498DB' : '#3498DB88',
                                                            borderRadius: '4px 4px 0 0',
                                                        }}
                                                        title={`${formatDate(p.fecha)}: ${formatCurrencyDec(p.precioUnitario)}/${data.insumo.unidadMedida} - ${p.proveedor}`}
                                                    />
                                                    <span style={{ fontSize: '8px', color: 'var(--color-gray-400)', marginTop: 1 }}>
                                                        {new Date(p.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}
                                                    </span>
                                                </div>
                                            ))
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Por proveedor */}
                            {data.porProveedor.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-6)' }}>
                                    <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', fontWeight: 700 }}>
                                        Compras por Proveedor
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {data.porProveedor.map((p: any, i: number) => {
                                            const pct = data.resumen.totalGastado > 0 ? (p.gasto / data.resumen.totalGastado) * 100 : 0
                                            return (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                    <span style={{ minWidth: 120, fontSize: 'var(--text-sm)', fontWeight: 600 }}>{p.nombre}</span>
                                                    <div style={{ flex: 1, height: 20, backgroundColor: 'var(--color-gray-100)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#F39C12', borderRadius: 'var(--radius-sm)', transition: 'width 0.5s ease' }} />
                                                    </div>
                                                    <span style={{ minWidth: 100, textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formatCurrency(p.gasto)}</span>
                                                    <span style={{ minWidth: 50, textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)' }}>{p.compras} fc</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Tabla de movimientos */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                                    <h4 style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>
                                        Movimientos ({filteredMovimientos.length})
                                    </h4>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                        <label style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <input type="checkbox" checked={soloEntradas} onChange={e => setSoloEntradas(e.target.checked)} />
                                            Solo compras
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="🔍 Buscar proveedor, factura..."
                                            value={filtro}
                                            onChange={e => setFiltro(e.target.value)}
                                            style={{ maxWidth: 220, fontSize: 'var(--text-xs)', padding: '4px 8px' }}
                                        />
                                    </div>
                                </div>
                                <div className="table-container" style={{ maxHeight: 350, overflow: 'auto' }}>
                                    <table className="table" style={{ fontSize: 'var(--text-sm)' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Fecha</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Tipo</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1, textAlign: 'right' }}>Cantidad</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1, textAlign: 'right' }}>$/Ud.</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1, textAlign: 'right' }}>Costo Total</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Proveedor</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>FC/Remito</th>
                                                <th style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-gray-50)', zIndex: 1 }}>Pago</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMovimientos.length === 0 ? (
                                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>Sin movimientos</td></tr>
                                            ) : (
                                                filteredMovimientos.map((m: any) => (
                                                    <tr key={m.id}>
                                                        <td>{formatDate(m.fecha)}</td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: 'var(--text-xs)',
                                                                padding: '2px 8px',
                                                                borderRadius: 'var(--radius-full)',
                                                                backgroundColor: m.tipo === 'entrada' ? '#2ECC7122' : '#E74C3C22',
                                                                color: m.tipo === 'entrada' ? '#2ECC71' : '#E74C3C',
                                                                fontWeight: 600
                                                            }}>
                                                                {m.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida'}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{formatNum(m.cantidad)} {data.insumo.unidadMedida}</td>
                                                        <td style={{ textAlign: 'right' }}>{m.precioUnitario > 0 ? formatCurrencyDec(m.precioUnitario) : '—'}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.costoTotal > 0 ? formatCurrency(m.costoTotal) : '—'}</td>
                                                        <td>{m.proveedor}</td>
                                                        <td style={{ fontSize: 'var(--text-xs)' }}>{m.factura}</td>
                                                        <td>
                                                            <span style={{
                                                                fontSize: 'var(--text-xs)',
                                                                padding: '2px 6px',
                                                                borderRadius: 'var(--radius-full)',
                                                                backgroundColor: m.estadoPago === 'pagado' ? '#2ECC7122' : '#F39C1222',
                                                                color: m.estadoPago === 'pagado' ? '#2ECC71' : '#F39C12',
                                                                fontWeight: 600
                                                            }}>
                                                                {m.estadoPago}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
