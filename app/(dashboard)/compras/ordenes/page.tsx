'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './ordenes.module.css'

type Proveedor = { id: string; nombre: string }
type Insumo = { id: string; nombre: string; unidadMedida: string; proveedorId: string | null; proveedores: Array<{ proveedorId: string }> }
type Ubicacion = { id: string; nombre: string }
type Detalle = { insumoId: string; cantidad: string; observaciones: string }
type Orden = { id: string; numero: number; fechaLocal: string; proveedorNombre: string; ubicacionNombre: string | null; creadoPorNombre: string; detalles: Array<{ id: string; insumoNombre: string; cantidad: number; unidadMedida: string }> }
type Catalogo = { proveedores: Proveedor[]; insumos: Insumo[]; ubicaciones: Ubicacion[] }

const vacio = (): Detalle => ({ insumoId: '', cantidad: '', observaciones: '' })

export default function OrdenesCompraPage() {
    const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
    const [ordenes, setOrdenes] = useState<Orden[]>([])
    const [total, setTotal] = useState(0)
    const [pagina, setPagina] = useState(1)
    const [proveedorId, setProveedorId] = useState('')
    const [ubicacionId, setUbicacionId] = useState('')
    const [observaciones, setObservaciones] = useState('')
    const [detalles, setDetalles] = useState<Detalle[]>([vacio()])
    const [filtroProveedor, setFiltroProveedor] = useState('')
    const [mostrarTodos, setMostrarTodos] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    async function cargarOrdenes(p = pagina, proveedor = filtroProveedor) {
        const params = new URLSearchParams({ pagina: String(p) })
        if (proveedor) params.set('proveedorId', proveedor)
        const res = await fetch(`/api/compras/ordenes?${params}`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el historial')
        setOrdenes(data.ordenes)
        setTotal(data.total)
    }

    useEffect(() => {
        Promise.all([
            fetch('/api/compras/ordenes/catalogo', { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'No se pudo cargar el catálogo'); return data as Catalogo }),
            fetch('/api/compras/ordenes?pagina=1', { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'No se pudo cargar el historial'); return data as { ordenes: Orden[]; total: number } }),
        ]).then(([catalogo, historial]) => { setCatalogo(catalogo); setOrdenes(historial.ordenes); setTotal(historial.total) })
            .catch((err) => setError(err.message)).finally(() => setCargando(false))
    }, [])

    const insumosVisibles = useMemo(() => (catalogo?.insumos || []).filter((insumo) => mostrarTodos || !proveedorId || detalles.some((item) => item.insumoId === insumo.id) || insumo.proveedorId === proveedorId || insumo.proveedores.some((p) => p.proveedorId === proveedorId)), [catalogo, proveedorId, mostrarTodos, detalles])

    function actualizarDetalle(index: number, cambios: Partial<Detalle>) {
        setDetalles((prev) => prev.map((item, i) => i === index ? { ...item, ...cambios } : item))
    }

    async function crear(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setGuardando(true)
        try {
            const res = await fetch('/api/compras/ordenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proveedorId, ubicacionId, observaciones, detalles }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo crear la orden')
            setDetalles([vacio()]); setObservaciones(''); setUbicacionId('')
            setFiltroProveedor(''); setPagina(1)
            await cargarOrdenes(1, '')
            window.location.assign(`/compras/ordenes/${data.id}`)
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo crear la orden') }
        finally { setGuardando(false) }
    }

    if (cargando) return <div className="empty-state"><div className="spinner" /><p>Cargando órdenes...</p></div>

    return <div className={styles.page}>
        <div className="page-header"><div><Link href="/compras">← Compras</Link><h1>Órdenes de compra</h1><p>Prepará una lista para comprar y conservá una copia imprimible.</p></div></div>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <section className={styles.card}>
            <h2>Nueva orden</h2>
            <form onSubmit={crear}>
                <div className={styles.fields}>
                    <label>Proveedor *<select className="form-select" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setMostrarTodos(false); setDetalles([vacio()]) }} required><option value="">Seleccionar proveedor</option>{catalogo?.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
                    <label>Sede de destino <select className="form-select" value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)}><option value="">Sin especificar</option>{catalogo?.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></label>
                </div>
                {proveedorId && <label className={styles.check}><input type="checkbox" checked={mostrarTodos} onChange={(e) => setMostrarTodos(e.target.checked)} /> Mostrar todos los insumos activos, incluso los no asociados al proveedor</label>}
                <div className={styles.rows}>
                    {detalles.map((detalle, index) => <div className={styles.row} key={index}>
                        <label>Insumo *<select className="form-select" value={detalle.insumoId} onChange={(e) => actualizarDetalle(index, { insumoId: e.target.value })} required><option value="">Seleccionar insumo</option>{insumosVisibles.filter((i) => i.id === detalle.insumoId || !detalles.some((d, j) => j !== index && d.insumoId === i.id)).map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidadMedida})</option>)}</select></label>
                        <label>Cantidad *<input className="form-input" type="number" min="0.001" step="any" value={detalle.cantidad} onChange={(e) => actualizarDetalle(index, { cantidad: e.target.value })} required /></label>
                        <label>Nota del renglón<input className="form-input" maxLength={300} value={detalle.observaciones} onChange={(e) => actualizarDetalle(index, { observaciones: e.target.value })} placeholder="Opcional" /></label>
                        <button type="button" className="btn btn-ghost" disabled={detalles.length === 1} onClick={() => setDetalles((prev) => prev.filter((_, i) => i !== index))} aria-label={`Quitar renglón ${index + 1}`}>✕</button>
                    </div>)}
                </div>
                <button type="button" className="btn btn-ghost" disabled={detalles.length >= 100} onClick={() => setDetalles((prev) => [...prev, vacio()])}>+ Agregar insumo</button>
                <label className={styles.notes}>Observaciones generales<textarea className="form-input" rows={3} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Indicaciones para quien realiza la compra" /></label>
                <div className={styles.actions}><button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar y abrir para imprimir'}</button></div>
            </form>
        </section>
        <section className={styles.card}>
            <div className={styles.historyHeader}><h2>Historial ({total})</h2><label>Proveedor <select className="form-select" value={filtroProveedor} onChange={(e) => { const valor = e.target.value; setFiltroProveedor(valor); setPagina(1); cargarOrdenes(1, valor).catch((err) => setError(err.message)) }}><option value="">Todos</option>{catalogo?.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label></div>
            {ordenes.length === 0 ? <p>No hay órdenes para este filtro.</p> : <div className={styles.history}>{ordenes.map((orden) => <div className={styles.historyRow} key={orden.id}><div><strong>Orden #{orden.numero} · {orden.proveedorNombre}</strong><span>{orden.fechaLocal.split('-').reverse().join('/')} · {orden.detalles.length} insumo{orden.detalles.length === 1 ? '' : 's'}{orden.ubicacionNombre ? ` · ${orden.ubicacionNombre}` : ''} · {orden.creadoPorNombre}</span></div><Link className="btn btn-ghost" href={`/compras/ordenes/${orden.id}`}>Ver / imprimir</Link></div>)}</div>}
            {total > 20 && <div className={styles.pagination}><button className="btn btn-ghost" disabled={pagina === 1} onClick={() => { setPagina(pagina - 1); cargarOrdenes(pagina - 1).catch((err) => setError(err.message)) }}>Anterior</button><span>Página {pagina} de {Math.ceil(total / 20)}</span><button className="btn btn-ghost" disabled={pagina * 20 >= total} onClick={() => { setPagina(pagina + 1); cargarOrdenes(pagina + 1).catch((err) => setError(err.message)) }}>Siguiente</button></div>}
        </section>
    </div>
}
