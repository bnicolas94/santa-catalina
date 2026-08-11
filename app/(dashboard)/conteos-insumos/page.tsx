'use client'

import { useEffect, useMemo, useState } from 'react'

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
    stocks: { ubicacionId: string; cantidad: number }[]
}

interface Conteo {
    id: string
    fecha: string
    ubicacion: { nombre: string }
    responsable: { nombre: string; apellido: string | null } | null
    detalles: {
        id: string
        stockSistema: number
        cantidadContada: number
        diferencia: number
        insumo: { nombre: string; unidadMedida: string }
    }[]
}

const parseCantidad = (value: string) => Number(value.replace(',', '.'))

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
            setUbicacionId((actual) => actual || ubicacionesData.find((item: Ubicacion) => item.tipo === 'FABRICA')?.id || ubicacionesData[0]?.id || '')
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

    const stockUbicacion = (insumo: Insumo) => insumo.stocks.find((stock) => stock.ubicacionId === ubicacionId)?.cantidad || 0
    const lineasCargadas = Object.entries(cantidades).filter(([, value]) => value.trim() !== '')

    async function confirmarConteo() {
        setError(''); setSuccess('')
        if (!ubicacionId || lineasCargadas.length === 0) {
            setError('Ingresá al menos una cantidad contada')
            return
        }
        if (lineasCargadas.some(([, value]) => !Number.isFinite(parseCantidad(value)) || parseCantidad(value) < 0)) {
            setError('Revisá las cantidades: deben ser números mayores o iguales a cero')
            return
        }
        if (!window.confirm('¿Confirmar el conteo? Las diferencias actualizarán el stock y quedarán registradas como movimientos de ajuste.')) return

        setSaving(true)
        try {
            const response = await fetch('/api/conteos-insumos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ubicacionId,
                    observaciones,
                    detalles: lineasCargadas.map(([insumoId, cantidadContada]) => ({ insumoId, cantidadContada })),
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo registrar el conteo')
            setCantidades({}); setObservaciones('')
            setSuccess(`Conteo confirmado: ${payload.detalles.length} insumos registrados.`)
            await cargarDatos()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo registrar el conteo')
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
                <label className="form-group"><span className="form-label">Ubicación</span><select className="form-select" value={ubicacionId} onChange={(event) => { setUbicacionId(event.target.value); setCantidades({}) }}>
                    {ubicaciones.map((ubicacion) => <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.nombre}</option>)}
                </select></label>
                <label className="form-group"><span className="form-label">Buscar insumo</span><input className="form-input" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Jamón, queso, pan..." /></label>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr><th>Insumo</th><th>Stock sistema</th><th>Cantidad contada</th><th>Diferencia</th></tr></thead>
                    <tbody>{insumosFiltrados.map((insumo) => {
                        const sistema = stockUbicacion(insumo)
                        const value = cantidades[insumo.id] ?? ''
                        const contado = value === '' ? null : parseCantidad(value)
                        const diferencia = contado !== null && Number.isFinite(contado) ? contado - sistema : null
                        return <tr key={insumo.id}>
                            <td><strong>{insumo.nombre}</strong><small style={{ display: 'block', color: 'var(--color-gray-400)' }}>{insumo.unidadMedida}</small></td>
                            <td>{sistema.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {insumo.unidadMedida}</td>
                            <td><input className="form-input" style={{ maxWidth: 170 }} inputMode="decimal" value={value} onChange={(event) => setCantidades((actual) => ({ ...actual, [insumo.id]: event.target.value }))} placeholder="Sin contar" /></td>
                            <td style={{ color: diferencia === null || Math.abs(diferencia) < 0.000001 ? 'var(--color-gray-400)' : diferencia > 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                                {diferencia === null ? '—' : `${diferencia > 0 ? '+' : ''}${diferencia.toLocaleString('es-AR', { maximumFractionDigits: 3 })}`}
                            </td>
                        </tr>
                    })}</tbody>
                </table>
            </div>
            <label className="form-group" style={{ marginTop: 'var(--space-4)' }}><span className="form-label">Observaciones</span><textarea className="form-input" value={observaciones} onChange={(event) => setObservaciones(event.target.value)} placeholder="Responsable, sector o aclaraciones del conteo" rows={2} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}><button className="btn btn-primary" disabled={saving || lineasCargadas.length === 0} onClick={confirmarConteo}>{saving ? 'Confirmando...' : `Confirmar conteo (${lineasCargadas.length})`}</button></div>
        </div>

        <h2 style={{ marginBottom: 'var(--space-3)' }}>Últimos conteos</h2>
        <div className="table-container"><table className="table"><thead><tr><th>Fecha</th><th>Ubicación</th><th>Responsable</th><th>Insumos</th><th>Diferencia neta</th></tr></thead>
            <tbody>{conteos.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Todavía no hay conteos registrados.</td></tr> : conteos.map((conteo) => <tr key={conteo.id}>
                <td>{new Date(conteo.fecha).toLocaleString('es-AR')}</td><td>{conteo.ubicacion.nombre}</td><td>{conteo.responsable ? `${conteo.responsable.nombre} ${conteo.responsable.apellido || ''}`.trim() : 'Sin identificar'}</td><td>{conteo.detalles.length}</td>
                <td>{conteo.detalles.reduce((total, detalle) => total + detalle.diferencia, 0).toLocaleString('es-AR', { maximumFractionDigits: 3 })}</td>
            </tr>)}</tbody>
        </table></div>
    </div>
}
