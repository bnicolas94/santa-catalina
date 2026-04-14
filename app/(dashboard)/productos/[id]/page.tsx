'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Insumo {
    id: string
    nombre: string
    precioUnitario: number
    unidadMedida: string
}

interface FichaTecnica {
    id: string
    cantidadPorUnidad: number
    unidadMedida: string
    merma: number
    insumo: Insumo
}

interface Presentacion {
    id: string
    cantidad: number
    precioVenta: number
}

interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    costoUnitario: number
    vidaUtilHoras: number
    tempConservacionMax: number
    activo: boolean
    presentaciones: Presentacion[]
    fichasTecnicas: FichaTecnica[]
}

export default function ProductoDetallePage() {
    const params = useParams()
    const router = useRouter()
    const [producto, setProducto] = useState<Producto | null>(null)
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddInsumo, setShowAddInsumo] = useState(false)
    const [fichaForm, setFichaForm] = useState({
        insumoId: '',
        cantidadPorUnidad: '',
        unidadMedida: 'kg',
        merma: '0',
    })
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        try {
            const [prodRes, insRes] = await Promise.all([
                fetch('/api/productos'),
                fetch('/api/insumos'),
            ])
            const productos = await prodRes.json()
            const prod = productos.find((p: Producto) => p.id === params.id)
            setProducto(prod || null)
            setInsumos(await insRes.json())
        } catch {
            setError('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    async function addInsumoToFicha(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        const mainPres = producto?.presentaciones?.[0];
        const unidadesBa = mainPres?.cantidad || 48;
        const cantidadUnitaria = parseFloat(fichaForm.cantidadPorUnidad) / unidadesBa;

        try {
            const res = await fetch('/api/fichas-tecnicas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: params.id,
                    ...fichaForm,
                    cantidadPorUnidad: cantidadUnitaria,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }

            setSuccess('Insumo agregado a la receta')
            setShowAddInsumo(false)
            setFichaForm({ insumoId: '', cantidadPorUnidad: '', unidadMedida: 'kg', merma: '0' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function removeInsumoFromFicha(fichaId: string) {
        try {
            await fetch(`/api/fichas-tecnicas?id=${fichaId}`, { method: 'DELETE' })
            setSuccess('Insumo removido de la receta')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch {
            setError('Error al eliminar')
        }
    }

    if (loading) {
        return (
            <div className="empty-state">
                <div className="spinner" />
                <p>Cargando producto...</p>
            </div>
        )
    }

    if (!producto) {
        return (
            <div className="empty-state">
                <p>Producto no encontrado</p>
                <button className="btn btn-primary" onClick={() => router.push('/productos')}>
                    Volver a Productos
                </button>
            </div>
        )
    }

    const cdi = producto.fichasTecnicas.reduce(
        (acc, f) => {
            const mermaFactor = f.merma ? (f.merma / 100) : 0;
            const cantidadReal = f.cantidadPorUnidad / (1 - mermaFactor);
            return acc + (cantidadReal * f.insumo.precioUnitario);
        },
        0
    )

    // Usamos la primera presentación como base para calcular el lote (usualmente 48 uds)
    const mainPres = producto.presentaciones?.[0];
    const unidadesBase = mainPres?.cantidad || 48;

    const cdiLote = cdi * unidadesBase;
    const precioReferencia = mainPres ? mainPres.precioVenta : 0;
    const precioPorUnidad = (precioReferencia > 0 && mainPres && mainPres.cantidad > 0) ? (precioReferencia / mainPres.cantidad) : 0;

    const margen = precioPorUnidad > 0
        ? ((precioPorUnidad - cdi) / precioPorUnidad * 100).toFixed(1)
        : '—'

    // Insumos que ya están en la ficha
    const insumosEnFicha = new Set(producto.fichasTecnicas.map((f) => f.insumo.id))
    const insumosDisponibles = insumos.filter((i) => !insumosEnFicha.has(i.id))

    return (
        <div>
            <div className="page-header">
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/productos')} style={{ marginBottom: 'var(--space-2)' }}>
                        ← Volver a Productos
                    </button>
                    <h1>
                        <span className="badge badge-neutral" style={{ marginRight: 8, fontSize: 'var(--text-lg)' }}>
                            {producto.codigoInterno}
                        </span>
                        {producto.nombre}
                    </h1>
                </div>
                <span className={`badge ${producto.activo ? 'badge-success' : 'badge-neutral'}`}>
                    {producto.activo ? 'Activo' : 'Inactivo'}
                </span>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Info del producto */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>Precio Venta (Ref)</div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-secondary)' }}>
                            {precioReferencia > 0 ? `$${precioReferencia.toLocaleString('es-AR')}` : '—'}
                        </div>
                        {producto.presentaciones.length > 1 && (
                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '4px' }}>
                                Basado en x{mainPres?.cantidad} unidades
                            </div>
                        )}
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>CDI (Costo Insumos)</div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: cdi > 0 ? 'var(--color-primary)' : 'var(--color-gray-400)' }}>
                            {cdiLote > 0 ? `$${cdiLote.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '4px' }}>
                            ${cdi.toLocaleString('es-AR', { minimumFractionDigits: 2 })} por sándwich
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>Margen Bruto</div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: parseFloat(margen as string) > 30 ? 'var(--color-success)' : parseFloat(margen as string) > 15 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                            {cdi > 0 ? `${margen}%` : '—'}
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-ui)' }}>Vida Útil</div>
                        <div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-secondary)' }}>
                            {producto.vidaUtilHoras}h
                        </div>
                    </div>
                </div>
            </div>

            {/* Ficha Técnica / Escandallo */}
            <div className="card">
                <div className="card-header">
                    <h3>📝 Ficha Técnica (Escandallo)</h3>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddInsumo(true)}>
                        + Agregar Insumo
                    </button>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Insumo</th>
                                <th>Cant. (x {unidadesBase} uds)</th>
                                <th>Merma</th>
                                <th>Costo (x {unidadesBase})</th>
                                <th>Costo Unitario</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {producto.fichasTecnicas.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>
                                        Sin insumos en la receta. Agregá insumos para calcular el CDI.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {producto.fichasTecnicas.map((f) => (
                                        <tr key={f.id}>
                                            <td style={{ fontWeight: 600 }}>{f.insumo.nombre}</td>
                                            <td>
                                                {(f.cantidadPorUnidad * unidadesBase).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {f.unidadMedida}
                                            </td>
                                            <td>
                                                {f.merma ? `${f.merma}%` : '0%'}
                                            </td>
                                            <td>
                                                ${(
                                                    ((f.cantidadPorUnidad * unidadesBase) / (1 - (f.merma ? (f.merma / 100) : 0))) * f.insumo.precioUnitario
                                                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                ${(
                                                    (f.cantidadPorUnidad / (1 - (f.merma ? (f.merma / 100) : 0))) * f.insumo.precioUnitario
                                                ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => removeInsumoFromFicha(f.id)}
                                                    style={{ color: 'var(--color-danger)' }}
                                                >
                                                    Quitar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ fontWeight: 700, backgroundColor: 'var(--color-gray-50)' }}>
                                        <td>TOTAL CDI</td>
                                        <td></td>
                                        <td></td>
                                        <td>${cdiLote.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        <td>${cdi.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal agregar insumo a ficha */}
            {showAddInsumo && (
                <div className="modal-overlay" onClick={() => setShowAddInsumo(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Agregar Insumo a la Receta</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddInsumo(false)}>✕</button>
                        </div>
                        <form onSubmit={addInsumoToFicha}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Insumo</label>
                                    <select
                                        className="form-select"
                                        value={fichaForm.insumoId}
                                        onChange={(e) => {
                                            const ins = insumos.find((i) => i.id === e.target.value)
                                            setFichaForm({
                                                ...fichaForm,
                                                insumoId: e.target.value,
                                                unidadMedida: ins?.unidadMedida || 'kg',
                                            })
                                        }}
                                        required
                                    >
                                        <option value="">Seleccionar insumo...</option>
                                        {insumosDisponibles.map((ins) => (
                                            <option key={ins.id} value={ins.id}>
                                                {ins.nombre} (${ins.precioUnitario}/{ins.unidadMedida})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cant. Neta (para {producto?.presentaciones?.[0]?.cantidad || 48} uds)*</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            className="form-input"
                                            value={fichaForm.cantidadPorUnidad}
                                            onChange={(e) => setFichaForm({ ...fichaForm, cantidadPorUnidad: e.target.value })}
                                            required
                                            placeholder="Ej: 1.68"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">% Merma</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="form-input"
                                            value={fichaForm.merma}
                                            onChange={(e) => setFichaForm({ ...fichaForm, merma: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Unidad</label>
                                        <input
                                            className="form-input"
                                            value={fichaForm.unidadMedida}
                                            onChange={(e) => setFichaForm({ ...fichaForm, unidadMedida: e.target.value })}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAddInsumo(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Agregar a la receta
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
