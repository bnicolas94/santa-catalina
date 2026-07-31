'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type StockUbicacion = { ubicacionId: string; cantidad: number }
type Catalogos = {
    ubicaciones: { id: string; nombre: string }[]
    productos: {
        id: string
        nombre: string
        presentaciones: { id: string; cantidad: number; stocks: StockUbicacion[] }[]
    }[]
    insumos: { id: string; nombre: string; unidadMedida: string; stocks: StockUbicacion[] }[]
}

type RegistroMerma = {
    id: string
    fecha: string
    origen: string
    origenLabel: string
    item: string
    cantidad: number
    unidad: string
    ubicacion: string
    motivo: string
    costoUnitario: number
    costoTotal: number
    costoHistorico: boolean
}

type MermaData = {
    registros: RegistroMerma[]
    resumen: {
        costoTotal: number
        costoAnterior: number
        variacionPct: number | null
        totalRegistros: number
        estimados: number
        porOrigen: { origen: string; nombre: string; registros: number; costo: number }[]
        porMotivo: { motivo: string; registros: number; costo: number }[]
    }
    catalogos: Catalogos
}

const MOTIVOS = ['Vencimiento', 'Calidad', 'Rotura', 'Error de producción', 'Conservación', 'Ajuste de inventario', 'Otro']

const formatCurrency = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const formatDate = (value: string) => new Date(value).toLocaleDateString('es-AR')

export default function MermasCostosPage() {
    const hoy = new Date()
    const [mes, setMes] = useState(String(hoy.getMonth() + 1))
    const [anio, setAnio] = useState(String(hoy.getFullYear()))
    const [ubicacionId, setUbicacionId] = useState('')
    const [data, setData] = useState<MermaData | null>(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [form, setForm] = useState({
        tipo: 'insumo',
        fecha: new Date().toLocaleDateString('en-CA'),
        ubicacionId: '',
        insumoId: '',
        productoPresentacion: '',
        cantidad: '',
        motivo: '',
        observaciones: ''
    })

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({ mes, anio })
            if (ubicacionId) params.set('ubicacionId', ubicacionId)
            const response = await fetch(`/api/costos/mermas?${params}`)
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'No se pudieron cargar las mermas')
            setData(body)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudieron cargar las mermas')
        } finally {
            setLoading(false)
        }
    }, [mes, anio, ubicacionId])

    useEffect(() => { void fetchData() }, [fetchData])

    const presentaciones = useMemo(() => (data?.catalogos.productos || []).flatMap(producto =>
        producto.presentaciones.map(presentacion => ({
            ...presentacion,
            productoId: producto.id,
            productoNombre: producto.nombre,
            key: `${producto.id}|${presentacion.id}`
        }))
    ), [data])

    const selectedInsumo = data?.catalogos.insumos.find(insumo => insumo.id === form.insumoId)
    const selectedPresentacion = presentaciones.find(presentacion => presentacion.key === form.productoPresentacion)
    const stockDisponible = form.tipo === 'insumo'
        ? selectedInsumo?.stocks.find(stock => stock.ubicacionId === form.ubicacionId)?.cantidad || 0
        : selectedPresentacion?.stocks.find(stock => stock.ubicacionId === form.ubicacionId)?.cantidad || 0
    const unidad = form.tipo === 'insumo' ? selectedInsumo?.unidadMedida || 'unidades' : 'paquetes'

    function abrirModal() {
        const ubicacionInicial = ubicacionId || data?.catalogos.ubicaciones[0]?.id || ''
        setForm({
            tipo: 'insumo',
            fecha: new Date().toLocaleDateString('en-CA'),
            ubicacionId: ubicacionInicial,
            insumoId: '',
            productoPresentacion: '',
            cantidad: '',
            motivo: '',
            observaciones: ''
        })
        setError('')
        setShowModal(true)
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const [productoId, presentacionId] = form.productoPresentacion.split('|')
            const response = await fetch('/api/costos/mermas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: form.tipo,
                    fecha: form.fecha,
                    ubicacionId: form.ubicacionId,
                    cantidad: Number(form.cantidad),
                    motivo: form.motivo,
                    observaciones: form.observaciones,
                    insumoId: form.tipo === 'insumo' ? form.insumoId : undefined,
                    productoId: form.tipo === 'producto' ? productoId : undefined,
                    presentacionId: form.tipo === 'producto' ? presentacionId : undefined
                })
            })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'No se pudo registrar la merma')
            setShowModal(false)
            setSuccess(`Merma registrada. Pérdida valorizada: ${formatCurrency(body.costoTotal || 0)}`)
            await fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo registrar la merma')
        } finally {
            setSaving(false)
        }
    }

    const variacion = data?.resumen.variacionPct ?? null

    return (
        <div>
            <div className="page-header" style={{ alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                    <h1>🗑️ Mermas / Desperdicio</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>
                        Pérdidas de insumos, producto terminado y rechazos de producción valorizadas a costo.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <Link href="/costos" className="btn btn-outline">← Gastos operativos</Link>
                    <button className="btn btn-primary" onClick={abrirModal}>+ Registrar merma</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Mes</label>
                        <select className="form-select" value={mes} onChange={event => setMes(event.target.value)}>
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((nombre, index) => (
                                <option key={nombre} value={index + 1}>{nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Año</label>
                        <select className="form-select" value={anio} onChange={event => setAnio(event.target.value)}>
                            {[2024, 2025, 2026, 2027, 2028].map(value => <option key={value}>{value}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                        <label className="form-label">Ubicación</label>
                        <select className="form-select" value={ubicacionId} onChange={event => setUbicacionId(event.target.value)}>
                            <option value="">Todas</option>
                            {data?.catalogos.ubicaciones.map(ubicacion => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p>Calculando pérdidas...</p></div>
            ) : data && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                        <SummaryCard label="Pérdida valorizada" value={formatCurrency(data.resumen.costoTotal)} color="var(--color-danger)" />
                        <SummaryCard label="Período anterior" value={formatCurrency(data.resumen.costoAnterior)} color="var(--color-gray-600)" />
                        <SummaryCard
                            label="Variación"
                            value={variacion === null ? 'Sin base anterior' : `${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%`}
                            color={variacion !== null && variacion > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
                        />
                        <SummaryCard label="Registros" value={String(data.resumen.totalRegistros)} color="var(--color-info)" />
                    </div>

                    {data.resumen.estimados > 0 && (
                        <div style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-5)', borderRadius: 'var(--radius-md)', background: '#FFF8E6', border: '1px solid #F6C453', color: '#7A5400', fontSize: 'var(--text-sm)' }}>
                            {data.resumen.estimados} registro(s) histórico(s) no guardaron un costo congelado; se valorizaron con los precios vigentes.
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 'var(--space-5)', alignItems: 'start' }}>
                        <div className="card" style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Origen</th>
                                        <th>Ítem</th>
                                        <th>Motivo</th>
                                        <th>Ubicación</th>
                                        <th style={{ textAlign: 'right' }}>Cantidad</th>
                                        <th style={{ textAlign: 'right' }}>Pérdida</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.registros.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center" style={{ padding: '2rem' }}>No se registraron mermas en el período.</td></tr>
                                    ) : data.registros.map(registro => (
                                        <tr key={registro.id}>
                                            <td>{formatDate(registro.fecha)}</td>
                                            <td><span className="badge">{registro.origenLabel}</span></td>
                                            <td style={{ fontWeight: 600 }}>{registro.item}</td>
                                            <td>{registro.motivo}</td>
                                            <td>{registro.ubicacion}</td>
                                            <td style={{ textAlign: 'right' }}>{registro.cantidad.toLocaleString('es-AR')} {registro.unidad}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: 700 }}>
                                                {formatCurrency(registro.costoTotal)}{!registro.costoHistorico && ' *'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <Breakdown title="Por origen" rows={data.resumen.porOrigen.map(row => ({ label: row.nombre, value: row.costo, count: row.registros }))} />
                            <Breakdown title="Por motivo" rows={data.resumen.porMotivo.map(row => ({ label: row.motivo, value: row.costo, count: row.registros }))} />
                        </div>
                    </div>
                </>
            )}

            {showModal && data && (
                <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
                    <div className="modal" onClick={event => event.stopPropagation()} style={{ maxWidth: 620 }}>
                        <div className="modal-header">
                            <h2>Registrar merma / desperdicio</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} disabled={saving}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Tipo de pérdida</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button type="button" className={`btn ${form.tipo === 'insumo' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm(current => ({ ...current, tipo: 'insumo', productoPresentacion: '', cantidad: '' }))}>Insumo</button>
                                        <button type="button" className={`btn ${form.tipo === 'producto' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setForm(current => ({ ...current, tipo: 'producto', insumoId: '', cantidad: '' }))}>Producto terminado</button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha</label>
                                        <input className="form-input" type="date" value={form.fecha} onChange={event => setForm({ ...form, fecha: event.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Ubicación</label>
                                        <select className="form-select" value={form.ubicacionId} onChange={event => setForm({ ...form, ubicacionId: event.target.value, cantidad: '' })} required>
                                            <option value="">Seleccionar...</option>
                                            {data.catalogos.ubicaciones.map(ubicacion => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {form.tipo === 'insumo' ? (
                                    <div className="form-group">
                                        <label className="form-label">Insumo</label>
                                        <select className="form-select" value={form.insumoId} onChange={event => setForm({ ...form, insumoId: event.target.value, cantidad: '' })} required>
                                            <option value="">Seleccionar...</option>
                                            {data.catalogos.insumos.map(insumo => <option key={insumo.id} value={insumo.id}>{insumo.nombre} ({insumo.unidadMedida})</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Producto y presentación</label>
                                        <select className="form-select" value={form.productoPresentacion} onChange={event => setForm({ ...form, productoPresentacion: event.target.value, cantidad: '' })} required>
                                            <option value="">Seleccionar...</option>
                                            {presentaciones.map(presentacion => <option key={presentacion.key} value={presentacion.key}>{presentacion.productoNombre} — x{presentacion.cantidad}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad ({unidad})</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min={form.tipo === 'producto' ? 1 : 0.001}
                                            step={form.tipo === 'producto' ? 1 : 0.001}
                                            max={stockDisponible || undefined}
                                            value={form.cantidad}
                                            onChange={event => setForm({ ...form, cantidad: event.target.value })}
                                            required
                                        />
                                        <small style={{ color: 'var(--color-gray-500)' }}>Disponible: {stockDisponible.toLocaleString('es-AR')} {unidad}</small>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo</label>
                                        <select className="form-select" value={form.motivo} onChange={event => setForm({ ...form, motivo: event.target.value })} required>
                                            <option value="">Seleccionar...</option>
                                            {MOTIVOS.map(motivo => <option key={motivo}>{motivo}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observaciones</label>
                                    <textarea className="form-input" rows={3} maxLength={500} value={form.observaciones} onChange={event => setForm({ ...form, observaciones: event.target.value })} placeholder="Detalle opcional para auditoría" />
                                </div>
                                <div style={{ padding: 'var(--space-3)', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
                                    Al guardar se descontará el stock y se congelará su costo como pérdida del período.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || stockDisponible <= 0}>{saving ? 'Guardando...' : 'Registrar y descontar stock'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color, fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', marginTop: 4 }}>{value}</div>
        </div>
    )
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number; count: number }[] }) {
    return (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>{title}</h3>
            {rows.length === 0 ? <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Sin datos.</p> : rows.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '8px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>{row.label} <small style={{ color: 'var(--color-gray-500)' }}>({row.count})</small></span>
                    <strong style={{ color: 'var(--color-danger)', whiteSpace: 'nowrap' }}>{formatCurrency(row.value)}</strong>
                </div>
            ))}
        </div>
    )
}
