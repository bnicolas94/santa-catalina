'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './stock-sucursales.module.css'

type Insumo = { id: string; nombre: string; unidadMedida: string; familia: { nombre: string } | null }
type Detalle = { insumoId: string; cantidadInformada: number | null; cantidadSolicitada: number | null; insumo: { nombre: string; unidadMedida: string } }
type Reporte = { id: string; fechaLocal: string; estado: string; version: number; observaciones: string | null; enviadoAt: string | null; detalles: Detalle[] }
type Datos = { sede: { nombre: string }; fechaLocal: string; insumos: Insumo[]; reporte: Reporte | null; historial: Reporte[] }
type Valores = Record<string, { tiene: string; pide: string }>

function valoresDelReporte(reporte: Reporte | null): Valores {
    return Object.fromEntries((reporte?.detalles || []).map((detalle) => [detalle.insumoId, {
        tiene: detalle.cantidadInformada === null ? '' : String(detalle.cantidadInformada),
        pide: detalle.cantidadSolicitada === null ? '' : String(detalle.cantidadSolicitada),
    }]))
}

export default function StockSucursalesPage() {
    const [datos, setDatos] = useState<Datos | null>(null)
    const [valores, setValores] = useState<Valores>({})
    const [observaciones, setObservaciones] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [dirty, setDirty] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    async function cargar() {
        setError('')
        const response = await fetch('/api/stock-sucursales', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el panel')
        const siguiente = payload as Datos
        setDatos(siguiente)
        setValores(valoresDelReporte(siguiente.reporte))
        setObservaciones(siguiente.reporte?.observaciones || '')
        setDirty(false)
    }

    useEffect(() => { cargar().catch((err) => setError(err.message)) }, [])
    const insumos = useMemo(() => (datos?.insumos || []).filter((insumo) => {
        const texto = `${insumo.nombre} ${insumo.familia?.nombre || ''}`.toLocaleLowerCase('es')
        return texto.includes(busqueda.trim().toLocaleLowerCase('es'))
    }), [datos, busqueda])
    const enviado = datos?.reporte?.estado === 'enviado'
    const filasCargadas = Object.values(valores).filter((valor) => valor.tiene.trim() || valor.pide.trim()).length

    function cambiar(id: string, campo: 'tiene' | 'pide', value: string) {
        setValores((actual) => ({ ...actual, [id]: { tiene: actual[id]?.tiene || '', pide: actual[id]?.pide || '', [campo]: value } }))
        setDirty(true)
        setNotice('')
    }

    async function guardar() {
        if (!datos || enviado) return
        setError(''); setNotice(''); setSaving(true)
        try {
            const response = await fetch('/api/stock-sucursales', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                version: datos.reporte?.version || 0,
                observaciones,
                detalles: Object.entries(valores).map(([insumoId, valor]) => ({ insumoId, cantidadInformada: valor.tiene, cantidadSolicitada: valor.pide })),
            }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo guardar')
            setDatos((actual) => actual ? { ...actual, reporte: payload as Reporte } : actual)
            setDirty(false)
            setNotice('Borrador guardado')
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
        finally { setSaving(false) }
    }

    async function enviar() {
        if (!datos?.reporte || dirty || enviado || !filasCargadas) return
        if (!window.confirm('¿Enviar el reporte de hoy? Después de enviarlo no podrá editarse.')) return
        setError(''); setNotice(''); setSaving(true)
        try {
            const response = await fetch('/api/stock-sucursales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: datos.reporte.version }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'No se pudo enviar')
            await cargar()
            setNotice('Reporte enviado')
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo enviar') }
        finally { setSaving(false) }
    }

    if (!datos) return <div className={styles.panel}><h1>Stock del local</h1><p>{error || 'Cargando…'}</p><Link href="/stock-sucursales/central">Ver pedidos de reposición</Link></div>

    return <div className={styles.panel}>
        <header className={styles.header}><div><h1>Stock del local</h1><p>{datos.sede.nombre} · {datos.fechaLocal}</p></div><span className={styles.badge}>{enviado ? 'Enviado' : 'Borrador'}</span></header>
        <p>Indicá lo que hay en el local y la cantidad que necesitás recibir. Estas cifras son un reporte y no ajustan el stock del sistema.</p>
        {enviado && <p className={styles.notice}>El reporte de hoy ya se envió. Podrás cargar uno nuevo mañana.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        <label className={styles.search}>Buscar insumo o familia<input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar…" /></label>
        <div className={styles.list}>{insumos.map((insumo) => <div className={styles.item} key={insumo.id}>
            <div><strong>{insumo.nombre}</strong><small>{insumo.familia?.nombre || 'Sin familia'} · {insumo.unidadMedida}</small></div>
            <label>Tenemos <span>({insumo.unidadMedida})</span><input inputMode="decimal" placeholder="Sin revisar" value={valores[insumo.id]?.tiene || ''} onChange={(event) => cambiar(insumo.id, 'tiene', event.target.value)} disabled={enviado || saving} /></label>
            <label>Solicitamos <span>({insumo.unidadMedida})</span><input inputMode="decimal" placeholder="Sin pedido" value={valores[insumo.id]?.pide || ''} onChange={(event) => cambiar(insumo.id, 'pide', event.target.value)} disabled={enviado || saving} /></label>
        </div>)}</div>
        <label className={styles.notes}>Observaciones<textarea value={observaciones} maxLength={500} onChange={(event) => { setObservaciones(event.target.value); setDirty(true) }} disabled={enviado || saving} placeholder="Datos útiles para preparar el pedido" /></label>
        {!enviado && <div className={styles.actions}><button type="button" onClick={guardar} disabled={saving || (!dirty && !!datos.reporte)}>{saving ? 'Guardando…' : 'Guardar borrador'}</button><button type="button" onClick={enviar} disabled={saving || dirty || !datos.reporte || !filasCargadas}>Enviar reporte</button><small>{dirty ? 'Guardá los cambios antes de enviar.' : `${filasCargadas} insumos cargados`}</small></div>}
        <section className={styles.history}><h2>Reportes anteriores</h2>{datos.historial.length === 0 ? <p>Todavía no hay reportes enviados.</p> : datos.historial.map((reporte) => <details key={reporte.id}><summary>{reporte.fechaLocal} · {reporte.detalles.length} insumos</summary><ul>{reporte.detalles.map((detalle) => <li key={detalle.insumoId}>{detalle.insumo.nombre}: tenemos {detalle.cantidadInformada ?? 'sin informar'}; solicitamos {detalle.cantidadSolicitada ?? 'sin pedido'} {detalle.insumo.unidadMedida}</li>)}</ul></details>)}</section>
    </div>
}
