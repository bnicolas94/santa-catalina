'use client'

import { useState, useEffect } from 'react'

interface CategoriaGasto {
    id: string
    nombre: string
    color: string
}

interface GastoOperativo {
    id: string
    fecha: string
    monto: number
    descripcion: string
    recurrente: boolean
    categoria: CategoriaGasto
}

export default function CostosPage() {
    const [gastos, setGastos] = useState<GastoOperativo[]>([])
    const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCatModal, setShowCatModal] = useState(false)

    const [form, setForm] = useState({
        fecha: new Date().toISOString().slice(0, 10),
        monto: '',
        descripcion: '',
        categoriaId: '',
        recurrente: false
    })

    const [catForm, setCatForm] = useState({
        nombre: '',
        color: '#E74C3C'
    })

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const date = new Date()
    const [mes, setMes] = useState(String(date.getMonth() + 1))
    const [anio, setAnio] = useState(String(date.getFullYear()))

    useEffect(() => {
        fetchData()
        fetchCategorias()
    }, [mes, anio])

    async function fetchCategorias() {
        try {
            const res = await fetch('/api/gastos/categorias')
            const data = await res.json()
            setCategorias(Array.isArray(data) ? data : [])
        } catch { console.error('Error al cargar categorias') }
    }

    async function fetchData() {
        setLoading(true)
        try {
            const res = await fetch(`/api/gastos?mes=${mes}&anio=${anio}`)
            const data = await res.json()
            setGastos(Array.isArray(data) ? data : [])
        } catch {
            setError('Error al cargar gastos')
        } finally {
            setLoading(false)
        }
    }

    async function handleAddGasto(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/gastos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            if (!res.ok) throw new Error('Error al registrar')
            setSuccess('Gasto registrado con éxito')
            setShowModal(false)
            setForm({ fecha: new Date().toISOString().slice(0, 10), monto: '', descripcion: '', categoriaId: '', recurrente: false })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleAddCat(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await fetch('/api/gastos/categorias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catForm)
            })
            if (!res.ok) throw new Error('Error al crear categoría')
            setShowCatModal(false)
            setCatForm({ nombre: '', color: '#E74C3C' })
            fetchCategorias()
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    const totalGastado = gastos.reduce((acc, g) => acc + g.monto, 0)

    // Agrupar gastos por categoría
    const gastosPorCat = gastos.reduce((acc: Record<string, { total: number, color: string }>, g) => {
        const catName = g.categoria.nombre
        if (!acc[catName]) acc[catName] = { total: 0, color: g.categoria.color }
        acc[catName].total += g.monto
        return acc
    }, {})

    return (
        <div>
            <div className="page-header">
                <h1>💸 Gastos Operativos</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginRight: 'var(--space-4)' }}>
                        <select className="form-select" value={mes} onChange={e => setMes(e.target.value)} style={{ width: 150 }}>
                            <option value="1">Enero</option>
                            <option value="2">Febrero</option>
                            <option value="3">Marzo</option>
                            <option value="4">Abril</option>
                            <option value="5">Mayo</option>
                            <option value="6">Junio</option>
                            <option value="7">Julio</option>
                            <option value="8">Agosto</option>
                            <option value="9">Septiembre</option>
                            <option value="10">Octubre</option>
                            <option value="11">Noviembre</option>
                            <option value="12">Diciembre</option>
                        </select>
                        <select className="form-select" value={anio} onChange={e => setAnio(e.target.value)} style={{ width: 100 }}>
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                        </select>
                    </div>
                    <button className="btn btn-outline" onClick={() => setShowCatModal(true)}>+ Categoría</button>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Registrar Gasto</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 'var(--space-6)' }}>
                {/* Panel lateral: Resumen por categoría */}
                <div>
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="card-body" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Total Periodo</div>
                            <div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-danger)' }}>
                                ${totalGastado.toLocaleString('es-AR')}
                            </div>
                        </div>
                    </div>

                    <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>Desglose</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {Object.entries(gastosPorCat).map(([cat, { total, color }]) => (
                            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', backgroundColor: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-200)', borderLeft: `4px solid ${color}` }}>
                                <strong>{cat}</strong>
                                <span>${total.toLocaleString('es-AR')}</span>
                            </div>
                        ))}
                        {Object.keys(gastosPorCat).length === 0 && (
                            <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>No hay gastos en este periodo.</p>
                        )}
                    </div>
                </div>

                {/* Tabla de gastos */}
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>Categoría</th>
                                <th>Monto</th>
                                <th>Recurrente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="text-center">Cargando...</td></tr>
                            ) : gastos.length === 0 ? (
                                <tr><td colSpan={5} className="text-center" style={{ padding: '2rem' }}>No se registraron cobros/gastos este mes</td></tr>
                            ) : (
                                gastos.map(g => (
                                    <tr key={g.id}>
                                        <td>{new Date(g.fecha).toLocaleDateString('es-AR')}</td>
                                        <td style={{ fontWeight: 600 }}>{g.descripcion}</td>
                                        <td>
                                            <span className="badge" style={{ backgroundColor: `${g.categoria.color}20`, color: g.categoria.color, border: `1px solid ${g.categoria.color}` }}>
                                                {g.categoria.nombre}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                                            ${g.monto.toLocaleString('es-AR')}
                                        </td>
                                        <td>{g.recurrente ? '🔄 Sí' : 'No'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Gasto */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Gasto</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddGasto}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha</label>
                                        <input type="date" className="form-input" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Monto ($)</label>
                                        <input type="number" step="0.01" className="form-input" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="Ej: 45000" required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción</label>
                                    <input type="text" className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Factura de luz Edesur" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Categoría</label>
                                    <select className="form-select" value={form.categoriaId} onChange={e => setForm({ ...form, categoriaId: e.target.value })} required>
                                        <option value="">Seleccionar categoría...</option>
                                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <input type="checkbox" id="recurrente" checked={form.recurrente} onChange={e => setForm({ ...form, recurrente: e.target.checked })} />
                                    <label htmlFor="recurrente" style={{ margin: 0 }}>Gasto fijo recurrente</label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Categoría */}
            {showCatModal && (
                <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2>Nueva Categoría</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCatModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddCat}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nombre (Ej: Sueldos, Servicios)</label>
                                    <input type="text" className="form-input" value={catForm.nombre} onChange={e => setCatForm({ ...catForm, nombre: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Color identificador</label>
                                    <input type="color" className="form-input" style={{ padding: '0 4px', height: 40 }} value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
