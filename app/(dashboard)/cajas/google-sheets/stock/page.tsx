'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'

interface Registro {
    id: string; hoja: string; externalId: string; productoTexto: string; cantidadTexto: string
    ubicacionTexto: string; estadoProcesamiento: string; detalle: string | null; ubicacion?: { nombre: string } | null
    movimientos?: { cantidad: number; presentacion: { cantidad: number; producto: { nombre: string } } }[]
}
interface Resumen {
    config: { activo: boolean; activadoEn: string | null }
    estado: { ultimaSincronizacion?: string; filasLeidas: number; descontados: number; pendientes: number; revisiones: number; error?: string }
    pendientes: Registro[]; recientes: Registro[]; totalPendientes: number
    presentaciones: { id: string; cantidad: number; producto: { nombre: string; codigoInterno: string } }[]
    sedes: { id: string; nombre: string; tipo: string }[]
}
interface VistaPrevia {
    pedido: string; hoja: string; productoSheet: string; sede: string; presentacion: string
    paquetes: number; stockActual: number; stockResultante: number
    huellaStock: string; registroUpdatedAt: string; stockUpdatedAt: string | null
}

async function cargar(url: string): Promise<Resumen> {
    const respuesta = await fetch(url)
    const datos = await respuesta.json()
    if (!respuesta.ok) throw new Error(datos.error || 'No se pudo cargar la integración.')
    return datos
}

export default function StockGoogleSheetsPage() {
    const { data, error: errorCarga, mutate } = useSWR('/api/caja/google-sheets/stock', cargar, { refreshInterval: 30_000 })
    const [registroId, setRegistroId] = useState('')
    const [presentacionId, setPresentacionId] = useState('')
    const [ubicacionId, setUbicacionId] = useState('')
    const [paquetes, setPaquetes] = useState(1)
    const [preview, setPreview] = useState<VistaPrevia | null>(null)
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')

    async function solicitar(metodo: 'PATCH' | 'POST', cuerpo: object) {
        const respuesta = await fetch('/api/caja/google-sheets/stock', {
            method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
        })
        const datos = await respuesta.json()
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la operación.')
        return datos
    }

    async function ejecutar(accion: () => Promise<void>) {
        setOcupado(true); setError(''); setMensaje('')
        try { await accion(); await mutate() }
        catch (e) { setPreview(null); setError(e instanceof Error ? e.message : 'No se pudo completar la operación.') }
        finally { setOcupado(false) }
    }

    const fila = data?.pendientes.find(item => item.id === registroId)
    const seleccion = { registroId, presentacionId, ubicacionId, paquetes }

    return <div>
        <div className="page-header"><div><h1>Entregas del Sheet y stock</h1><p>Descuenta paquetes de la sede indicada cuando un pedido pasa a Entregado.</p></div>
            <Link className="btn btn-secondary" href="/cajas/google-sheets">Volver al Sheet de Caja</Link></div>
        {(error || errorCarga) && <p role="alert" className="toast toast-error">{error || errorCarga?.message}</p>}
        {mensaje && <p role="status" className="toast toast-success">{mensaje}</p>}
        {!data ? <p>Cargando…</p> : <>
            <section className="card" style={{ marginBottom: 20 }}><h2>Sincronización de stock</h2>
                <p><strong>{data.config.activo ? 'Activa' : 'Pausada'}</strong>. Usa las mismas pestañas y sedes configuradas en Caja. «Fábrica» descuenta de Central.</p>
                <p>Al activar, los pedidos que ya figuran entregados quedan como historial. Sólo se descuentan entregas nuevas. Los sabores personalizados esperan revisión.</p>
                {data.estado.ultimaSincronizacion && <p>Última lectura: {new Date(data.estado.ultimaSincronizacion).toLocaleString('es-AR')} · {data.estado.filasLeidas} filas · {data.estado.descontados} descuentos en el último ciclo.</p>}
                {data.estado.error && <p role="alert">Último error: {data.estado.error}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" disabled={ocupado} onClick={() => void ejecutar(async () => {
                        await solicitar('PATCH', { activo: !data.config.activo }); setMensaje(data.config.activo ? 'Sincronización pausada.' : 'Sincronización activada; los pedidos anteriores no se descuentan.')
                    })}>{data.config.activo ? 'Pausar descuentos' : 'Activar descuentos'}</button>
                    <button className="btn btn-secondary" disabled={ocupado || !data.config.activo} onClick={() => void ejecutar(async () => {
                        const resultado = await solicitar('POST', { accion: 'sincronizar' }); setMensaje(`${resultado.descontados} pedido(s) descontados en esta lectura.`)
                    })}>Sincronizar ahora</button>
                </div>
            </section>

            <section className="card" style={{ marginBottom: 20 }}><h2>Pendientes de revisión ({data.totalPendientes})</h2>
                <p>Un pedido dudoso no modifica el stock. Elegí una equivalencia sólo si conocés qué paquete salió realmente.</p>
                <div className="table-container"><table className="table"><thead><tr><th>Pedido</th><th>Sede del Sheet</th><th>Producto del Sheet</th><th>Unidades</th><th>Motivo</th><th></th></tr></thead><tbody>
                    {data.pendientes.map(item => <tr key={item.id}><td>#{item.externalId}<small style={{ display: 'block' }}>{item.hoja}</small></td><td>{item.ubicacionTexto}</td>
                        <td style={{ whiteSpace: 'pre-wrap', minWidth: 220 }}>{item.productoTexto}</td><td>{item.cantidadTexto}</td><td>{item.detalle || 'Revisar'}</td>
                        <td>{item.estadoProcesamiento === 'PENDIENTE_REVISION' && <button className="btn btn-secondary btn-sm" onClick={() => {
                            setRegistroId(item.id); setPresentacionId(''); setUbicacionId(''); setPaquetes(1); setPreview(null); setError('')
                        }}>Revisar</button>}</td></tr>)}
                    {!data.pendientes.length && <tr><td colSpan={6}>No hay pedidos pendientes.</td></tr>}
                </tbody></table></div>
                {data.totalPendientes > data.pendientes.length && <p>Se muestran los 50 más recientes. Resolvé algunos para ver los siguientes.</p>}
                {fila && <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                    <h3>Revisar pedido #{fila.externalId}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{fila.productoTexto}</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ display: 'grid', gap: 5, minWidth: 190 }}>Sede<select className="form-select" value={ubicacionId} onChange={e => { setUbicacionId(e.target.value); setPreview(null) }}><option value="">Seleccionar</option>{data.sedes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}</select></label>
                        <label style={{ display: 'grid', gap: 5, minWidth: 230 }}>Presentación<select className="form-select" value={presentacionId} onChange={e => { setPresentacionId(e.target.value); setPreview(null) }}><option value="">Seleccionar</option>{data.presentaciones.filter(p => ['JQ', 'CLA', 'ESP', 'ELE', 'PRE'].includes(p.producto.codigoInterno)).map(p => <option key={p.id} value={p.id}>{p.producto.nombre} x{p.cantidad}</option>)}</select></label>
                        <label style={{ display: 'grid', gap: 5, width: 130 }}>Paquetes<input className="form-input" type="number" min={1} max={100} value={paquetes} onChange={e => { setPaquetes(Number(e.target.value)); setPreview(null) }} /></label>
                    </div>
                    <button style={{ marginTop: 12 }} className="btn btn-secondary" disabled={ocupado || !ubicacionId || !presentacionId} onClick={() => void ejecutar(async () => {
                        const resultado = await solicitar('POST', { accion: 'previsualizar', ...seleccion }); setPreview(resultado)
                    })}>Ver descuento antes de confirmar</button>
                    {preview && <div style={{ marginTop: 16 }}><p><strong>{preview.paquetes} paquete(s) · {preview.presentacion} · {preview.sede}</strong></p>
                        <p>Stock actual: {preview.stockActual} → después del descuento: <strong>{preview.stockResultante}</strong></p>
                        <button className="btn btn-primary" disabled={ocupado} onClick={() => void ejecutar(async () => {
                            await solicitar('POST', { accion: 'confirmar', ...seleccion, ...preview }); setPreview(null); setRegistroId(''); setMensaje('Descuento registrado con movimiento de stock y referencia al pedido.')
                        })}>Confirmar descuento</button></div>}
                </div>}
            </section>

            <section className="card"><h2>Descuentos recientes</h2><div className="table-container"><table className="table"><thead><tr><th>Pedido</th><th>Sede</th><th>Paquetes descontados</th></tr></thead><tbody>
                {data.recientes.map(item => <tr key={item.id}><td>#{item.externalId} · {item.hoja}</td><td>{item.ubicacion?.nombre || item.ubicacionTexto}</td>
                    <td>{item.movimientos?.map(m => `${m.cantidad} ${m.presentacion.producto.nombre} x${m.presentacion.cantidad}`).join(' + ') || '—'}</td></tr>)}
                {!data.recientes.length && <tr><td colSpan={3}>Todavía no hay descuentos.</td></tr>}
            </tbody></table></div></section>
        </>}
    </div>
}
