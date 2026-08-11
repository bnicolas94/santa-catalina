'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Insumo {
    id: string
    nombre: string
    precioUnitario: number
    unidadMedida: string
}

interface Presentacion {
    id: string
    cantidad: number
    precioVenta: number
}

interface FichaTecnica {
    id: string
    cantidadPorUnidad: number
    unidadMedida: string
    merma: number
    tipoConsumo?: string
    presentacionId?: string | null
    insumo: Insumo
}

interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    vidaUtilHoras: number
    activo: boolean
    presentaciones: Presentacion[]
    fichasTecnicas: FichaTecnica[]
}

type FichaForm = {
    insumoId: string
    cantidadNetaPaquete: string
    merma: string
    tipoConsumo: 'por_unidad' | 'por_paquete'
    alcance: 'global' | 'presentacion'
}

const FORM_INICIAL: FichaForm = {
    insumoId: '',
    cantidadNetaPaquete: '',
    merma: '0',
    tipoConsumo: 'por_unidad',
    alcance: 'global',
}

function cantidadNetaPaquete(ficha: FichaTecnica, presentacion: Presentacion) {
    return ficha.tipoConsumo === 'por_paquete'
        ? ficha.cantidadPorUnidad
        : ficha.cantidadPorUnidad * presentacion.cantidad
}

function cantidadRealPaquete(ficha: FichaTecnica, presentacion: Presentacion) {
    const factor = 1 - Math.min(Math.max(ficha.merma || 0, 0), 99.99) / 100
    return cantidadNetaPaquete(ficha, presentacion) / factor
}

function formatoCantidad(value: number) {
    return value.toLocaleString('es-AR', { maximumFractionDigits: 4 })
}

function formatoDinero(value: number) {
    return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProductoDetallePage() {
    const params = useParams()
    const router = useRouter()
    const [producto, setProducto] = useState<Producto | null>(null)
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [presentacionId, setPresentacionId] = useState('')
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<FichaForm>(FORM_INICIAL)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    async function fetchData() {
        try {
            const [prodRes, insRes] = await Promise.all([fetch('/api/productos'), fetch('/api/insumos')])
            if (!prodRes.ok || !insRes.ok) throw new Error('No se pudieron cargar los datos')
            const productos: Producto[] = await prodRes.json()
            const actual = productos.find(item => item.id === params.id) || null
            setProducto(actual)
            setInsumos(await insRes.json())
            if (actual?.presentaciones.length) {
                setPresentacionId(current => current && actual.presentaciones.some(p => p.id === current)
                    ? current
                    : actual.presentaciones[0].id)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void fetchData() }, [])

    const presentacion = useMemo(
        () => producto?.presentaciones.find(item => item.id === presentacionId) || producto?.presentaciones[0],
        [producto, presentacionId],
    )
    const fichasVisibles = useMemo(
        () => producto?.fichasTecnicas.filter(ficha => !ficha.presentacionId || ficha.presentacionId === presentacion?.id) || [],
        [producto, presentacion],
    )
    const costoPaquete = presentacion
        ? fichasVisibles.reduce((total, ficha) => total + cantidadRealPaquete(ficha, presentacion) * ficha.insumo.precioUnitario, 0)
        : 0
    const precioVenta = presentacion?.precioVenta || 0
    const margen = precioVenta > 0 ? (precioVenta - costoPaquete) / precioVenta * 100 : null

    function abrirNuevaFicha() {
        setEditingId(null)
        setForm(FORM_INICIAL)
        setError('')
        setShowForm(true)
    }

    function abrirEdicion(ficha: FichaTecnica) {
        if (!presentacion) return
        setEditingId(ficha.id)
        setForm({
            insumoId: ficha.insumo.id,
            cantidadNetaPaquete: String(cantidadNetaPaquete(ficha, presentacion)),
            merma: String(ficha.merma || 0),
            tipoConsumo: ficha.tipoConsumo === 'por_paquete' ? 'por_paquete' : 'por_unidad',
            alcance: ficha.presentacionId ? 'presentacion' : 'global',
        })
        setError('')
        setShowForm(true)
    }

    async function guardarFicha(event: React.FormEvent) {
        event.preventDefault()
        if (!producto || !presentacion || saving) return
        setSaving(true)
        setError('')
        try {
            const response = await fetch('/api/fichas-tecnicas', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    productoId: producto.id,
                    insumoId: form.insumoId,
                    cantidadNetaPaquete: Number(form.cantidadNetaPaquete),
                    unidadesReferencia: presentacion.cantidad,
                    merma: Number(form.merma || 0),
                    tipoConsumo: form.tipoConsumo,
                    presentacionId: form.alcance === 'presentacion' ? presentacion.id : null,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la receta')
            setShowForm(false)
            setSuccess(editingId ? 'Línea de receta actualizada' : 'Insumo agregado a la receta')
            await fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo guardar la receta')
        } finally {
            setSaving(false)
        }
    }

    async function quitarFicha(ficha: FichaTecnica) {
        if (!window.confirm(`¿Quitar ${ficha.insumo.nombre} de esta receta?`)) return
        setError('')
        const response = await fetch(`/api/fichas-tecnicas?id=${ficha.id}`, { method: 'DELETE' })
        if (!response.ok) {
            const payload = await response.json()
            setError(payload.error || 'No se pudo quitar el insumo')
            return
        }
        setSuccess('Insumo removido de la receta')
        await fetchData()
        setTimeout(() => setSuccess(''), 3000)
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando producto...</p></div>
    if (!producto) return <div className="empty-state"><p>Producto no encontrado</p><button className="btn btn-primary" onClick={() => router.push('/productos')}>Volver a Productos</button></div>
    if (!presentacion) return <div className="empty-state"><p>Este producto no tiene presentaciones configuradas.</p></div>

    const insumoSeleccionado = insumos.find(item => item.id === form.insumoId)
    const previewNeto = Number(form.cantidadNetaPaquete) || 0
    const previewReal = previewNeto / (1 - Math.min(Math.max(Number(form.merma) || 0, 0), 99.99) / 100)

    return <div>
        <div className="page-header">
            <div>
                <button className="btn btn-ghost btn-sm" onClick={() => router.push('/productos')} style={{ marginBottom: 'var(--space-2)' }}>← Volver a Productos</button>
                <h1><span className="badge badge-neutral" style={{ marginRight: 8, fontSize: 'var(--text-lg)' }}>{producto.codigoInterno}</span>{producto.nombre}</h1>
            </div>
            <span className={`badge ${producto.activo ? 'badge-success' : 'badge-neutral'}`}>{producto.activo ? 'Activo' : 'Inactivo'}</span>
        </div>

        {success && <div className="toast toast-success">{success}</div>}
        {error && !showForm && <div className="toast toast-error">{error}</div>}

        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-body">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', color: 'var(--color-gray-500)' }}>Presentación que querés revisar</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {producto.presentaciones.map(item => <button key={item.id} className={`btn btn-sm ${item.id === presentacion.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPresentacionId(item.id)}>Paquete x{item.cantidad}</button>)}
                </div>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <Summary label="Precio de venta" value={precioVenta ? `$${formatoDinero(precioVenta)}` : '—'} detail={`Paquete x${presentacion.cantidad}`} />
            <Summary label="Costo de insumos" value={costoPaquete ? `$${formatoDinero(costoPaquete)}` : '—'} detail="Contenido + empaque + merma" />
            <Summary label="Margen bruto" value={margen === null ? '—' : `${margen.toFixed(1)}%`} detail={margen === null ? 'Falta precio de venta' : `$${formatoDinero(precioVenta - costoPaquete)} por paquete`} />
            <Summary label="Costo por ronda" value={costoPaquete ? `$${formatoDinero(costoPaquete * 7)}` : '—'} detail="7 paquetes" />
        </div>

        <div className="card">
            <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <div><h3>📝 Ficha técnica · paquete x{presentacion.cantidad}</h3><p style={{ margin: '5px 0 0', color: 'var(--color-gray-500)', fontSize: 13 }}>Los insumos generales escalan con la presentación; los envases pueden asignarse sólo a x{presentacion.cantidad}.</p></div>
                <button className="btn btn-primary btn-sm" onClick={abrirNuevaFicha}>+ Agregar insumo</button>
            </div>
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="table">
                    <thead><tr><th>Insumo</th><th>Cálculo</th><th>Alcance</th><th>Neto / paquete</th><th>Merma</th><th>Consumo real</th><th>Ronda x7</th><th>Costo / paquete</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {fichasVisibles.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>Esta presentación todavía no tiene receta. Agregá los insumos para calcular y descontar stock.</td></tr> : fichasVisibles.map(ficha => {
                            const neto = cantidadNetaPaquete(ficha, presentacion)
                            const real = cantidadRealPaquete(ficha, presentacion)
                            return <tr key={ficha.id}>
                                <td style={{ fontWeight: 700 }}>{ficha.insumo.nombre}<div style={{ fontSize: 11, color: 'var(--color-gray-400)', fontWeight: 400 }}>${formatoDinero(ficha.insumo.precioUnitario)} / {ficha.unidadMedida}</div></td>
                                <td><span className="badge badge-neutral">{ficha.tipoConsumo === 'por_paquete' ? 'Por paquete' : 'Por sándwich'}</span></td>
                                <td>{ficha.presentacionId ? <span className="badge badge-warning">Sólo x{presentacion.cantidad}</span> : <span className="badge badge-success">Todas</span>}</td>
                                <td>{formatoCantidad(neto)} {ficha.unidadMedida}</td>
                                <td>{formatoCantidad(ficha.merma || 0)}%</td>
                                <td style={{ fontWeight: 700 }}>{formatoCantidad(real)} {ficha.unidadMedida}</td>
                                <td>{formatoCantidad(real * 7)} {ficha.unidadMedida}</td>
                                <td>${formatoDinero(real * ficha.insumo.precioUnitario)}</td>
                                <td style={{ whiteSpace: 'nowrap' }}><button className="btn btn-ghost btn-sm" onClick={() => abrirEdicion(ficha)}>Editar</button><button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => void quitarFicha(ficha)}>Quitar</button></td>
                            </tr>
                        })}
                        {fichasVisibles.length > 0 && <tr style={{ fontWeight: 700, background: 'var(--color-gray-50)' }}><td colSpan={7}>TOTAL PAQUETE x{presentacion.cantidad}</td><td>${formatoDinero(costoPaquete)}</td><td /></tr>}
                    </tbody>
                </table>
            </div>
        </div>

        {showForm && <div className="modal-overlay" onMouseDown={() => setShowForm(false)}>
            <div className="modal" onMouseDown={event => event.stopPropagation()}>
                <div className="modal-header"><div><h2>{editingId ? 'Editar línea de receta' : 'Agregar insumo'}</h2><p style={{ margin: 0, color: 'var(--color-gray-500)', fontSize: 13 }}>Referencia: paquete x{presentacion.cantidad}</p></div><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>×</button></div>
                <form onSubmit={guardarFicha}>
                    <div className="modal-body">
                        {error && <div className="toast toast-error" style={{ position: 'static', marginBottom: 16 }}>{error}</div>}
                        <div className="form-group"><label className="form-label">Insumo</label><select className="form-select" value={form.insumoId} disabled={Boolean(editingId)} onChange={event => setForm({ ...form, insumoId: event.target.value })} required><option value="">Seleccionar insumo...</option>{insumos.map(insumo => <option key={insumo.id} value={insumo.id}>{insumo.nombre} · {insumo.unidadMedida}</option>)}</select></div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-4)' }}>
                            <div className="form-group"><label className="form-label">Forma de cálculo</label><select className="form-select" value={form.tipoConsumo} onChange={event => setForm({ ...form, tipoConsumo: event.target.value as FichaForm['tipoConsumo'] })}><option value="por_unidad">Por sándwich / unidad</option><option value="por_paquete">Cantidad fija por paquete</option></select><small style={{ color: 'var(--color-gray-500)' }}>{form.tipoConsumo === 'por_unidad' ? 'Ideal para fiambres, queso, pan y aderezos.' : 'Ideal para bandejas, etiquetas y envoltorios.'}</small></div>
                            <div className="form-group"><label className="form-label">Aplicar a</label><select className="form-select" value={form.alcance} onChange={event => setForm({ ...form, alcance: event.target.value as FichaForm['alcance'] })}><option value="global">Todas las presentaciones</option><option value="presentacion">Sólo paquete x{presentacion.cantidad}</option></select></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-4)' }}>
                            <div className="form-group"><label className="form-label">Cantidad neta para 1 paquete x{presentacion.cantidad}</label><input type="number" min="0.000001" step="any" className="form-input" value={form.cantidadNetaPaquete} onChange={event => setForm({ ...form, cantidadNetaPaquete: event.target.value })} placeholder={form.tipoConsumo === 'por_paquete' ? 'Ej: 1' : 'Ej: 0,67'} required /></div>
                            <div className="form-group"><label className="form-label">Merma técnica %</label><input type="number" min="0" max="99.99" step="0.01" className="form-input" value={form.merma} onChange={event => setForm({ ...form, merma: event.target.value })} /></div>
                            <div className="form-group"><label className="form-label">Unidad</label><input className="form-input" value={insumoSeleccionado?.unidadMedida || '—'} readOnly /></div>
                        </div>
                        {previewNeto > 0 && <div style={{ background: 'var(--color-gray-50)', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}><Preview label="Neto por paquete" value={`${formatoCantidad(previewNeto)} ${insumoSeleccionado?.unidadMedida || ''}`} /><Preview label="Se descuenta" value={`${formatoCantidad(previewReal)} ${insumoSeleccionado?.unidadMedida || ''}`} /><Preview label="Por ronda x7" value={`${formatoCantidad(previewReal * 7)} ${insumoSeleccionado?.unidadMedida || ''}`} /></div>}
                    </div>
                    <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar a la receta'}</button></div>
                </form>
            </div>
        </div>}
    </div>
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
    return <div className="card"><div className="card-body" style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div><div style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)', margin: '4px 0' }}>{value}</div><div style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>{detail}</div></div></div>
}

function Preview({ label, value }: { label: string; value: string }) {
    return <div><div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-gray-500)', fontWeight: 700 }}>{label}</div><strong style={{ fontSize: 13 }}>{value}</strong></div>
}
