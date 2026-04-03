"use client"

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useRouter } from 'next/navigation'

interface Vehiculo {
    id: string
    patente: string
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
    categoria: { nombre: string }
    vehiculo: { patente: string }
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

    // Form state
    const [selectedVehiculo, setSelectedVehiculo] = useState('')
    const [selectedCategoria, setSelectedCategoria] = useState('')
    const [selectedCaja, setSelectedCaja] = useState('caja_chica')
    const [monto, setMonto] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [kmVehiculo, setKmVehiculo] = useState('')
    const [taller, setTaller] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        try {
            const [vehRes, catRes, gasRes] = await Promise.all([
                fetch('/api/flota/vehiculos'),
                fetch('/api/reportes/categorias'), // Usamos las categorías de gastos operativos generales
                fetch('/api/logistica/flota/gastos')
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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedVehiculo || !selectedCategoria || !monto || !descripcion || !selectedCaja) {
            toast.error('Completá todos los campos obligatorios')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/logistica/flota/gastos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    monto,
                    descripcion,
                    categoriaId: selectedCategoria,
                    vehiculoId: selectedVehiculo,
                    kmVehiculo,
                    taller,
                    cajaTipo: selectedCaja
                })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error)
            }

            toast.success('Gasto registrado con éxito')
            // Reset form
            setMonto('')
            setDescripcion('')
            setKmVehiculo('')
            setTaller('')
            fetchData()
        } catch (error: any) {
            toast.error(error.message || 'Error al registrar el gasto')
        } finally {
            setSaving(false)
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
                    <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Registrar Gasto</h2>
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
                                    <option key={v.id} value={v.id}>{v.patente} - {v.marca} {v.modelo}</option>
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
                            <textarea className="form-input" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Carga de Diesel, Cambio de aceite..." required />
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
                            {saving ? 'Procesando...' : '💰 Registrar Gasto'}
                        </button>
                    </form>
                </div>

                {/* Listado Reciente */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Últimos Gastos de Flota</h2>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Vehículo</th>
                                    <th>Categoría</th>
                                    <th>Descripción</th>
                                    <th style={{ textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-10)' }}>Cargando historial...</td></tr>
                                ) : gastos.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-10)' }}>No hay gastos registrados.</td></tr>
                                ) : (
                                    gastos.map(g => (
                                        <tr key={g.id}>
                                            <td style={{ fontSize: 'var(--text-sm)' }}>{new Date(g.fecha).toLocaleDateString()}</td>
                                            <td style={{ fontWeight: 'bold' }}>{g.vehiculo?.patente}</td>
                                            <td><span className="badge badge-outline">{g.categoria.nombre}</span></td>
                                            <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>
                                                {g.descripcion}
                                                {g.taller && <div style={{ fontSize: '10px', color: 'var(--color-primary)' }}>🛠️ {g.taller}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                                                -${g.monto.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
