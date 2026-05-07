"use client"

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface Vehiculo {
    id: string
    patente: string
    alias?: string
    marca: string
    modelo: string
}

interface Categoria {
    id: string
    nombre: string
}

interface Gasto {
    id: string
    fecha: string
    monto: number
    descripcion: string
    categoria: { id: string; nombre: string }
    vehiculo: { patente: string; alias?: string }
    kmVehiculo?: number
    taller?: string
}

export default function GastosFlotaPage() {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Filtros de tabla
    const dateNow = new Date()
    const firstDay = new Date(dateNow.getFullYear(), dateNow.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(dateNow.getFullYear(), dateNow.getMonth() + 1, 0).toISOString().split('T')[0]
    const [filterDesde, setFilterDesde] = useState(firstDay)
    const [filterHasta, setFilterHasta] = useState(lastDay)
    const [filterCategoriaId, setFilterCategoriaId] = useState('')

    // Form state
    const [selectedVehiculo, setSelectedVehiculo] = useState('')
    const [selectedCategoria, setSelectedCategoria] = useState('')
    const [selectedCaja, setSelectedCaja] = useState('caja_chica')
    const [monto, setMonto] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [kmVehiculo, setKmVehiculo] = useState('')
    const [taller, setTaller] = useState('')
    const [fechaVencimientoVtv, setFechaVencimientoVtv] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)

    const isVtv = categorias.find(c => c.id === selectedCategoria)?.nombre.toLowerCase() === 'vtv'

    useEffect(() => {
        fetchData()
    }, [filterDesde, filterHasta])

    async function fetchData() {
        setLoading(true)
        try {
            const qs = new URLSearchParams()
            if (filterDesde) qs.set('fechaDesde', filterDesde)
            if (filterHasta) qs.set('fechaHasta', filterHasta)

            const [vehRes, catRes, gasRes] = await Promise.all([
                fetch('/api/flota/vehiculos'),
                fetch('/api/reportes/categorias'), // Usamos las categorías de gastos operativos generales
                fetch(`/api/logistica/flota/gastos?${qs.toString()}`)
            ])
            
            const vData = await vehRes.json()
            const cData = await catRes.json()
            const gData = await gasRes.json()

            setVehiculos(Array.isArray(vData) ? vData.filter((v: any) => v.activo) : [])
            setCategorias(Array.isArray(cData) ? cData : [])
            setGastos(Array.isArray(gData) ? gData : [])
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (gasto: Gasto) => {
        setEditingId(gasto.id)
        setFecha(new Date(gasto.fecha).toISOString().split('T')[0])
        setSelectedVehiculo(gasto.vehiculoId)
        setSelectedCategoria(gasto.categoriaId)
        setMonto(gasto.monto.toString())
        setDescripcion(gasto.descripcion || '')
        setKmVehiculo(gasto.kmVehiculo?.toString() || '')
        setTaller(gasto.taller || '')
        // Para VTV no podemos recuperar la fecha de vencimiento tan fácil sin fetch extra, 
        // pero podemos dejar que la vuelvan a poner si es necesario editarla.
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const resetForm = () => {
        setEditingId(null)
        setMonto('')
        setDescripcion('')
        setKmVehiculo('')
        setTaller('')
        setFechaVencimientoVtv('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedVehiculo || !selectedCategoria || !monto || !selectedCaja) {
            toast.error('Completá todos los campos obligatorios')
            return
        }

        if (isVtv && !fechaVencimientoVtv && !editingId) {
            toast.error('Completá la fecha de vencimiento de la VTV')
            return
        }

        setSaving(true)
        try {
            const url = editingId ? `/api/logistica/flota/gastos/${editingId}` : '/api/logistica/flota/gastos'
            const method = editingId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    monto,
                    descripcion,
                    categoriaId: selectedCategoria,
                    vehiculoId: selectedVehiculo,
                    kmVehiculo,
                    taller,
                    cajaTipo: selectedCaja,
                    vencimientoVtv: isVtv ? fechaVencimientoVtv : null
                })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error)
            }

            toast.success(editingId ? 'Gasto actualizado' : 'Gasto registrado con éxito')
            resetForm()
            fetchData()
        } catch (error: any) {
            toast.error(error.message || 'Error al procesar el gasto')
        } finally {
            setSaving(false)
        }
    }
    async function handleDelete(id: string) {
        if (!confirm('¿Estás seguro de eliminar este gasto? El monto será devuelto a la caja de origen.')) return

        try {
            const res = await fetch(`/api/logistica/flota/gastos/${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error)
            }

            toast.success('Gasto eliminado y caja actualizada')
            fetchData()
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar el gasto')
        }
    }

    return (
        <div className="page-content">
            <div className="page-header">
                <h1 className="page-title">Gastos de Flota</h1>
                <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>
                    Cargá gastos específicos vinculados a vehículos y descontá de caja automáticamente.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
                {/* Formulario */}
                <div className="card shadow-sm" style={{ padding: 'var(--space-5)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>{editingId ? 'Editar Gasto' : 'Registrar Gasto'}</h2>
                        {editingId && (
                            <button onClick={resetForm} className="btn btn-ghost btn-sm">Cancelar</button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Fecha</label>
                            <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Vehículo</label>
                            <select className="form-select" value={selectedVehiculo} onChange={e => setSelectedVehiculo(e.target.value)} required>
                                <option value="">Seleccionar vehículo...</option>
                                {vehiculos.map(v => (
                                    <option key={v.id} value={v.id}>{v.alias ? `${v.alias} (${v.patente})` : `${v.patente} - ${v.marca} ${v.modelo}`}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Categoría</label>
                            <select className="form-select" value={selectedCategoria} onChange={e => setSelectedCategoria(e.target.value)} required>
                                <option value="">Seleccionar categoría...</option>
                                {categorias.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {isVtv && (
                            <div className="form-group" style={{ backgroundColor: 'var(--color-success-light)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)' }}>
                                <label className="form-label" style={{ color: 'var(--color-success-dark)', fontWeight: 'bold' }}>📅 Nuevo Vencimiento VTV</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={fechaVencimientoVtv} 
                                    onChange={e => setFechaVencimientoVtv(e.target.value)} 
                                    required 
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Caja de Origen</label>
                            <select className="form-select" value={selectedCaja} onChange={e => setSelectedCaja(e.target.value)} required>
                                <option value="caja_chica">Caja Chica (Efectivo)</option>
                                <option value="caja_madre">Caja Madre</option>
                                <option value="mercado_pago">Mercado Pago</option>
                                <option value="local">Caja Local</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Monto ($)</label>
                            <input type="number" step="0.01" className="form-input" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Descripción / Novedad</label>
                            <textarea className="form-input" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Carga de Diesel, Cambio de aceite..." />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div className="form-group">
                                <label className="form-label">KM (Opcional)</label>
                                <input type="number" className="form-input" value={kmVehiculo} onChange={e => setKmVehiculo(e.target.value)} placeholder="KM actual" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Taller (Opcional)</label>
                                <input type="text" className="form-input" value={taller} onChange={e => setTaller(e.target.value)} placeholder="Nombre taller" />
                            </div>
                        </div>

                        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 'var(--space-2)' }}>
                            {saving ? 'Procesando...' : editingId ? '💾 Guardar Cambios' : '💰 Registrar Gasto'}
                        </button>
                    </form>
                </div>

                {/* Listado Reciente */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>Últimos Gastos (Agrupados por Vehículo)</h2>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <select 
                                className="form-select" 
                                style={{ padding: '4px 8px', fontSize: '12px', height: '32px', width: 'auto' }}
                                value={filterCategoriaId}
                                onChange={e => setFilterCategoriaId(e.target.value)}
                            >
                                <option value="">Todas las categorías</option>
                                {categorias.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                            <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }} value={filterDesde} onChange={e => setFilterDesde(e.target.value)} title="Fecha Desde" />
                            <input type="date" className="form-input" style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }} value={filterHasta} onChange={e => setFilterHasta(e.target.value)} title="Fecha Hasta" />
                        </div>
                    </div>
                    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {loading ? (
                            <p style={{ textAlign: 'center', padding: 'var(--space-10)' }}>Cargando historial...</p>
                        ) : gastos.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: 'var(--space-10)' }}>No hay gastos registrados.</p>
                        ) : (
                            (() => {
                                const filteredGastos = filterCategoriaId 
                                    ? gastos.filter(g => g.categoria.id === filterCategoriaId)
                                    : gastos

                                if (filteredGastos.length === 0) return <p style={{ textAlign: 'center', padding: 'var(--space-10)' }}>No hay gastos que coincidan con los filtros.</p>

                                const grouped = filteredGastos.reduce((acc, g) => {
                                    const originalV = g.vehiculo || { patente: 'Desconocido', alias: '' }
                                    const vKey = originalV.alias ? `${originalV.alias} (${originalV.patente})` : originalV.patente
                                    if (!acc[vKey]) acc[vKey] = { items: [], total: 0 }
                                    acc[vKey].items.push(g)
                                    acc[vKey].total += g.monto
                                    return acc
                                }, {} as Record<string, { items: Gasto[], total: number }>)

                                return Object.entries(grouped).map(([vKey, data]) => (
                                    <div key={vKey} style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                        <div style={{ backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'bold' }}>🚗 {vKey}</h3>
                                            <span style={{ fontWeight: 'bold', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                                                Total Agrupado: -${data.total.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                        <div className="table-container" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
                                            <table className="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Categoría</th>
                                                        <th>Descripción / Novedad</th>
                                                        <th style={{ textAlign: 'right' }}>Monto</th>
                                                        <th style={{ textAlign: 'right' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.items.map(g => (
                                                        <tr key={g.id}>
                                                            <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(g.fecha).toLocaleDateString('es-AR')}</td>
                                                            <td><span className="badge badge-outline">{g.categoria.nombre}</span></td>
                                                            <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>
                                                                {g.descripcion || 'Sin descripción'}
                                                                {g.taller && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--color-primary)' }}>🛠️ {g.taller}</span>}
                                                            </td>
                                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                                                                -${g.monto.toLocaleString('es-AR')}
                                                            </td>
                                                            <td style={{ textAlign: 'right', display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                                                                <button 
                                                                    onClick={() => handleEdit(g)}
                                                                    className="btn btn-ghost btn-sm"
                                                                    style={{ padding: '4px' }}
                                                                    title="Editar gasto"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDelete(g.id)}
                                                                    className="btn btn-ghost btn-sm"
                                                                    style={{ color: 'var(--color-danger)', padding: '4px' }}
                                                                    title="Eliminar gasto y devolver dinero a caja"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))
                            })()
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
