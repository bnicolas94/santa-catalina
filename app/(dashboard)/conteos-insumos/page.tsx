'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { parseCantidadConteo } from '@/lib/insumos/conteos'

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

interface Insumo {
    id: string
    nombre: string
    unidadMedida: string
    activo: boolean
    unidadSecundaria: string | null
    factorConversion: number | null
    stocks: { ubicacionId: string; cantidad: number; cantidadSecundaria: number }[]
}

interface Conteo {
    id: string
    fecha: string
    observaciones: string | null
    ubicacion: { nombre: string }
    responsable: { nombre: string; apellido: string | null } | null
    detalles: {
        id: string
        stockSistema: number
        cantidadContada: number
        diferencia: number
        movimientoStockId: string | null
        insumo: { nombre: string; unidadMedida: string }
    }[]
}

interface VistaPreviaConteo {
    ubicacion: { id: string; nombre: string }
    revisadoEn: string
    detalles: {
        insumoId: string
        nombre: string
        unidadMedida: string
        stockSistema: number
        stockSecundario: number
        cantidadContada: number
        diferencia: number
    }[]
}

export default function ConteosInsumosPage() {
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
    const [conteos, setConteos] = useState<Conteo[]>([])
    const [ubicacionId, setUbicacionId] = useState('')
    const [cantidades, setCantidades] = useState<Record<string, string>>({})
    const [observaciones, setObservaciones] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [revisando, setRevisando] = useState(false)
    const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaConteo | null>(null)
    const [conteoAbiertoId, setConteoAbiertoId] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    async function cargarDatos() {
        setLoading(true)
        try {
            const [insumosRes, ubicacionesRes, conteosRes] = await Promise.all([
                fetch('/api/insumos'),
                fetch('/api/operaciones/ubicaciones'),
                fetch('/api/conteos-insumos'),
            ])
            if (!insumosRes.ok || !ubicacionesRes.ok || !conteosRes.ok) throw new Error('No se pudieron cargar los datos')
            const [insumosData, ubicacionesData, conteosData] = await Promise.all([
                insumosRes.json(), ubicacionesRes.json(), conteosRes.json(),
            ])
            setInsumos(Array.isArray(insumosData) ? insumosData.filter((item: Insumo) => item.activo) : [])
            setUbicaciones(Array.isArray(ubicacionesData) ? ubicacionesData : [])
            setConteos(Array.isArray(conteosData) ? conteosData : [])
            setUbicacionId((actual) => ubicacionesData.some((item: Ubicacion) => item.id === actual) ? actual : '')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { cargarDatos() }, [])

    const insumosFiltrados = useMemo(() => {
        const termino = busqueda.trim().toLocaleLowerCase('es')
        return insumos.filter((insumo) => !termino || insumo.nombre.toLocaleLowerCase('es').includes(termino))
    }, [insumos, busqueda])

    const ubicacionSeleccionada = ubicaciones.find((ubicacion) => ubicacion.id === ubicacionId)

    function cambiarUbicacion(nuevaUbicacionId: string) {
        if (nuevaUbicacionId === ubicacionId) return
        if (Object.values(cantidades).some((value) => value.trim() !== '') &&
            !window.confirm('Cambiar de sede borrará las cantidades ingresadas. ¿Continuar?')) return
        setUbicacionId(nuevaUbicacionId)
        setCantidades({})
        setVistaPrevia(null)
        setError('')
        setSuccess('')
    }

    const stockUbicacion = (insumo: Insumo) => insumo.stocks.find((stock) => stock.ubicacionId === ubicacionId)?.cantidad || 0
    const stockSecundarioUbicacion = (insumo: Insumo) => insumo.stocks.find((stock) => stock.ubicacionId === ubicacionId)?.cantidadSecundaria || 0
    const lineasCargadas = Object.entries(cantidades).filter(([, value]) => value.trim() !== '')

    async function revisarConteo() {
        setError(''); setSuccess('')
        setVistaPrevia(null)
        if (!ubicacionSeleccionada) {
            setError('Seleccioná la sucursal o fábrica donde realizaste el conteo')
            return
        }
        if (lineasCargadas.length === 0) {
            setError('Ingresá al menos una cantidad contada')
            return
        }
        if (lineasCargadas.some(([, value]) => !Number.isFinite(parseCantidadConteo(value)))) {
            setError('Revisá las cantidades: deben ser números mayores o iguales a cero')
            return
        }
        setRevisando(true)
        try {
            const response = await fetch('/api/conteos-insumos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ubicacionId,
                    detalles: lineasCargadas.map(([insumoId, cantidadContada]) => ({ insumoId, cantidadContada })),
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo revisar el conteo')
            const previa = payload as VistaPreviaConteo
            setVistaPrevia(previa)
            const stocksActualizados = new Map(previa.detalles.map((detalle) => [detalle.insumoId, detalle]))
            setInsumos((actuales) => actuales.map((insumo) => {
                const detalle = stocksActualizados.get(insumo.id)
                if (!detalle) return insumo
                const otrosStocks = insumo.stocks.filter((stock) => stock.ubicacionId !== ubicacionId)
                return { ...insumo, stocks: [...otrosStocks, {
                    ubicacionId, cantidad: detalle.stockSistema, cantidadSecundaria: detalle.stockSecundario,
                }] }
            }))
        } catch (err) {
            setVistaPrevia(null)
            setError(err instanceof Error ? err.message : 'No se pudo revisar el conteo')
        } finally {
            setRevisando(false)
        }
    }

    async function confirmarConteo() {
        if (!vistaPrevia) return
        setError(''); setSuccess('')
        setSaving(true)
        try {
            const response = await fetch('/api/conteos-insumos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ubicacionId: vistaPrevia.ubicacion.id,
                    observaciones,
                    detalles: vistaPrevia.detalles.map((detalle) => ({
                        insumoId: detalle.insumoId,
                        cantidadContada: detalle.cantidadContada,
                        stockSistemaEsperado: detalle.stockSistema,
                    })),
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo registrar el conteo')
            setVistaPrevia(null)
            setCantidades({}); setObservaciones('')
            setSuccess(`Conteo confirmado en ${payload.ubicacion.nombre}: ${payload.detalles.length} insumos registrados.`)
            await cargarDatos()
        } catch (err) {
            setVistaPrevia(null)
            setError(err instanceof Error ? err.message : 'No se pudo registrar el conteo')
            await cargarDatos()
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando conteos...</p></div>

    return <div>
        <div className="page-header">
            <div><h1>🧮 Conteo físico de insumos</h1><p style={{ color: 'var(--color-gray-500)', marginTop: 6 }}>Las diferencias generan ajustes auditables en la ubicación elegida.</p></div>
        </div>

        {success && <div className="toast toast-success">{success}</div>}
        {error && <div className="toast toast-error">{error}</div>}

        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <strong>Momento de corte:</strong> mientras realizás este conteo, evitá iniciar rondas o registrar entradas y salidas de insumos en esta ubicación.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <label className="form-group"><span className="form-label">Sucursal o fábrica del conteo</span><select className="form-select" value={ubicacionId} disabled={revisando || saving} onChange={(event) => cambiarUbicacion(event.target.value)}>
                    <option value="">Seleccioná dónde se realizó el conteo</option>
                    <optgroup label="Sucursales">
                        {ubicaciones.filter((ubicacion) => ubicacion.tipo === 'LOCAL').map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}
                    </optgroup>
                    <optgroup label="Fábrica">
                        {ubicaciones.filter((ubicacion) => ubicacion.tipo === 'FABRICA').map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}
                    </optgroup>
                </select></label>
                <label className="form-group"><span className="form-label">Buscar insumo</span><input className="form-input" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Jamón, queso, pan..." /></label>
            </div>

            {!ubicacionSeleccionada && <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-gray-500)' }}>Elegí una sede para ver su stock y cargar las cantidades contadas.</p>}

            <div className="table-container">
                <table className="table">
                    <thead><tr><th>Insumo</th><th>Stock sistema</th><th>Cantidad contada (unidad principal)</th><th>Diferencia</th></tr></thead>
                    <tbody>{insumosFiltrados.map((insumo) => {
                        const sistema = stockUbicacion(insumo)
                        const value = cantidades[insumo.id] ?? ''
                        const contado = value.trim() === '' ? null : parseCantidadConteo(value)
                        const diferencia = contado !== null && Number.isFinite(contado) ? contado - sistema : null
                        return <tr key={insumo.id}>
                            <td>
                                <strong>{insumo.nombre}</strong>
                                <small style={{ display: 'block', color: 'var(--color-primary)', fontWeight: 700 }}>Ingresar conteo en {insumo.unidadMedida}</small>
                                {insumo.unidadSecundaria && insumo.factorConversion && (
                                    <small style={{ display: 'block', color: 'var(--color-gray-500)' }}>Referencia: 1 {insumo.unidadSecundaria} = {insumo.factorConversion.toLocaleString('es-AR')} {insumo.unidadMedida}</small>
                                )}
                            </td>
                            <td>
                                <div>{ubicacionSeleccionada ? `${sistema.toLocaleString('es-AR', { maximumFractionDigits: 3 })} ${insumo.unidadMedida}` : '—'}</div>
                                {ubicacionSeleccionada && insumo.unidadSecundaria && <small style={{ color: 'var(--color-gray-500)' }}>{stockSecundarioUbicacion(insumo).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {insumo.unidadSecundaria}</small>}
                            </td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 220 }}>
                                    <input className="form-input" inputMode="decimal" disabled={!ubicacionSeleccionada || revisando || saving} value={value} onChange={(event) => { setVistaPrevia(null); setCantidades((actual) => ({ ...actual, [insumo.id]: event.target.value })) }} placeholder={`Cantidad en ${insumo.unidadMedida}`} aria-label={`Cantidad contada de ${insumo.nombre} en ${insumo.unidadMedida}`} />
                                    <strong style={{ minWidth: 34, color: 'var(--color-primary)' }}>{insumo.unidadMedida}</strong>
                                </div>
                            </td>
                            <td style={{ color: diferencia === null || Math.abs(diferencia) < 0.000001 ? 'var(--color-gray-400)' : diferencia > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                                {diferencia === null ? '—' : `${diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-AR', { maximumFractionDigits: 3 })}`}
                            </td>
                        </tr>
                    })}</tbody>
                </table>
            </div>
            <label className="form-group" style={{ marginTop: 'var(--space-4)' }}><span className="form-label">Observaciones</span><textarea className="form-input" value={observaciones} onChange={(event) => setObservaciones(event.target.value)} placeholder="Responsable, sector o aclaraciones del conteo" rows={2} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}><button className="btn btn-primary" disabled={revisando || saving || !ubicacionSeleccionada || lineasCargadas.length === 0} onClick={revisarConteo}>{revisando ? 'Actualizando stock...' : `Revisar conteo (${lineasCargadas.length})`}</button></div>
            {vistaPrevia && <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--color-gray-300)', borderRadius: 'var(--radius-md)' }}>
                <h3>Vista previa: {vistaPrevia.ubicacion.nombre}</h3>
                <p style={{ color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)' }}>Stock actualizado al {new Date(vistaPrevia.revisadoEn).toLocaleString('es-AR')}. Revisá las diferencias antes de confirmar.</p>
                <div className="table-container"><table className="table"><thead><tr><th>Insumo</th><th>Stock actualizado</th><th>Contado</th><th>Ajuste</th></tr></thead><tbody>
                    {vistaPrevia.detalles.map((detalle) => <tr key={detalle.insumoId}>
                        <td>{detalle.nombre}</td>
                        <td>{detalle.stockSistema.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.unidadMedida}</td>
                        <td>{detalle.cantidadContada.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.unidadMedida}</td>
                        <td>{detalle.diferencia > 0 ? '+' : ''}{detalle.diferencia.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.unidadMedida}</td>
                    </tr>)}
                </tbody></table></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}><button className="btn btn-primary" disabled={saving} onClick={confirmarConteo}>{saving ? 'Confirmando...' : `Confirmar ajustes en ${vistaPrevia.ubicacion.nombre}`}</button></div>
            </div>}
        </div>

        <h2 style={{ marginBottom: 'var(--space-3)' }}>Últimos conteos</h2>
        <div className="table-container"><table className="table"><thead><tr><th>Fecha</th><th>Sucursal o fábrica</th><th>Responsable</th><th>Insumos</th><th>Insumos con diferencia</th><th>Detalle</th></tr></thead>
            <tbody>{conteos.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Todavía no hay conteos registrados.</td></tr> : conteos.map((conteo) => <Fragment key={conteo.id}><tr>
                <td>{new Date(conteo.fecha).toLocaleString('es-AR')}</td><td>{conteo.ubicacion.nombre}</td><td>{conteo.responsable ? `${conteo.responsable.nombre} ${conteo.responsable.apellido || ''}`.trim() : 'Sin identificar'}</td><td>{conteo.detalles.length}</td>
                <td>{conteo.detalles.filter((detalle) => Math.abs(detalle.diferencia) > 0.000001).length}</td>
                <td><button className="btn btn-secondary" aria-expanded={conteoAbiertoId === conteo.id} onClick={() => setConteoAbiertoId((actual) => actual === conteo.id ? null : conteo.id)}>{conteoAbiertoId === conteo.id ? 'Ocultar' : 'Ver ajustes'}</button></td>
            </tr>{conteoAbiertoId === conteo.id && <tr><td colSpan={6}>
                {conteo.observaciones && <p style={{ marginBottom: 'var(--space-3)' }}><strong>Observaciones:</strong> {conteo.observaciones}</p>}
                <div className="table-container"><table className="table"><thead><tr><th>Insumo</th><th>Stock anterior</th><th>Contado</th><th>Diferencia</th><th>Movimiento</th></tr></thead><tbody>
                    {conteo.detalles.map((detalle) => <tr key={detalle.id}>
                        <td>{detalle.insumo.nombre}</td>
                        <td>{detalle.stockSistema.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.insumo.unidadMedida}</td>
                        <td>{detalle.cantidadContada.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.insumo.unidadMedida}</td>
                        <td>{detalle.diferencia > 0 ? '+' : ''}{detalle.diferencia.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {detalle.insumo.unidadMedida}</td>
                        <td>{detalle.movimientoStockId ? 'Ajuste registrado' : 'Sin ajuste'}</td>
                    </tr>)}
                </tbody></table></div>
            </td></tr>}</Fragment>)}</tbody>
        </table></div>
    </div>
}
