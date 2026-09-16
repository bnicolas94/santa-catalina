'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'

interface Caja { id: string; tipo: string; nombre: string | null; activo: boolean; ubicacionId: string | null; ubicacion?: { nombre: string } | null }
interface Sede { id: string; nombre: string; activo: boolean; tipo: string }
interface Sucursal { id?: string; ubicacionTexto: string; ubicacionId: string; cajaEfectivoId: string | null; cajaTransferenciaId: string | null; activo: boolean }
interface Resumen {
    config: { activo: boolean; spreadsheetId: string; intervaloMinutos: number; fechaInicio: string | null }
    estado: { ultimaSincronizacion?: string; filasLeidas: number; incorporados: number; pendientes: number; revisiones: number; error?: string }
    sucursales: Sucursal[]
    recientes: { id: string; externalId: string; hoja: string; precio: number; pago: string; ubicacion: string; estadoFuente: string; estadoProcesamiento: string; detalle: string | null; fechaExterna: string | null; updatedAt: string }[]
    totalesPorHoja: { hoja: string; _count: { _all: number } }[]
}

async function cargar<T,>(url: string): Promise<T> {
    const response = await fetch(url)
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar la información.')
    return data
}

export default function IntegracionGoogleSheetsPage() {
    const { data, error: errorCarga, mutate, isLoading } = useSWR('/api/caja/google-sheets', cargar<Resumen>)
    const { data: cajas } = useSWR('/api/cajas', cargar<Caja[]>)
    const { data: sedes } = useSWR('/api/sedes', cargar<Sede[]>)
    const [sucursales, setSucursales] = useState<Sucursal[]>([])
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    useEffect(() => { if (data) setSucursales(data.sucursales.map(s => ({ ...s, cajaEfectivoId: s.cajaEfectivoId || null, cajaTransferenciaId: s.cajaTransferenciaId || null }))) }, [data])

    async function guardar() {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const response = await fetch('/api/caja/google-sheets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sucursales }) })
            const resultado = await response.json()
            if (!response.ok) throw new Error(resultado.error || 'No se pudo guardar.')
            await mutate(resultado); setMensaje('Destinos guardados.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
        finally { setOcupado(false) }
    }

    async function cambiarEstado(activo: boolean) {
        if (activo && !sucursales.some(s => s.activo && (s.cajaEfectivoId || s.cajaTransferenciaId))) {
            setError('Configurá al menos una caja antes de activar la integración.'); return
        }
        setOcupado(true); setError(''); setMensaje('')
        try {
            const response = await fetch('/api/caja/google-sheets', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: { ...data?.config, activo } }) })
            const resultado = await response.json()
            if (!response.ok) throw new Error(resultado.error || 'No se pudo cambiar el estado.')
            await mutate(resultado); setMensaje(activo ? 'Integración activada. Sólo tomará pedidos entregados desde este momento.' : 'Integración pausada.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.') }
        finally { setOcupado(false) }
    }

    async function sincronizar() {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const response = await fetch('/api/caja/google-sheets', { method: 'POST' })
            const resultado = await response.json()
            if (!response.ok) throw new Error(resultado.error || 'No se pudo sincronizar.')
            await mutate(); setMensaje(`Sincronización completa: ${resultado.incorporados || 0} movimientos incorporados.`)
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo sincronizar.') }
        finally { setOcupado(false) }
    }

    function actualizar(indice: number, cambio: Partial<Sucursal>) {
        setSucursales(actuales => actuales.map((fila, i) => i === indice ? { ...fila, ...cambio } : fila))
    }
    const cajasActivas = (cajas || []).filter(c => c.activo)
    function resultadoVisible(fila: Resumen['recientes'][number]) {
        if (fila.estadoProcesamiento === 'REGISTRADO') return 'Incorporado en Caja'
        if (fila.estadoProcesamiento === 'PENDIENTE_DATOS') return 'Datos incompletos'
        if (fila.estadoProcesamiento === 'PENDIENTE_CONFIGURACION') return 'Falta configurar caja'
        if (fila.estadoProcesamiento === 'REQUIERE_REVISION') return 'Requiere revisión'
        if (fila.estadoProcesamiento === 'IGNORADO') return 'Medio de pago no soportado'
        if (fila.estadoFuente === 'entregado') return 'Entregado anterior a la activación'
        return `Esperando estado Entregado (${fila.estadoFuente || 'sin estado'})`
    }
    return <div>
        <div className="page-header"><div><h1>Integración Google Sheets</h1><p>Registra en Caja los pedidos cuando su estado pasa a Entregado.</p></div>
            <div style={{ display: 'flex', gap: 8 }}><Link className="btn btn-secondary" href="/cajas">Volver a cajas</Link>
                <button className="btn btn-secondary" disabled={ocupado || !data?.config.activo} onClick={() => void sincronizar()}>{ocupado ? 'Procesando…' : 'Sincronizar ahora'}</button></div></div>
        {(error || errorCarga) && <p role="alert" className="toast toast-error">{error || errorCarga?.message}</p>}
        {mensaje && <p role="status" className="toast toast-success">{mensaje}</p>}
        {isLoading || !data ? <p>Cargando configuración…</p> : <>
            <section className="card" style={{ marginBottom: 20 }}><h2>Estado</h2>
                <p><strong>{data.config.activo ? 'Activa' : 'Pausada'}</strong>. Se revisan las pestañas Pedidos_comunes y Pedidos_online cada {data.config.intervaloMinutos} minutos.</p>
                <p>Los pedidos pendientes no modifican Caja. Al activar, comienza desde ese momento y no incorpora el historial anterior.</p>
                {data.estado.ultimaSincronizacion && <p>Última sincronización: {new Date(data.estado.ultimaSincronizacion).toLocaleString('es-AR')} · {data.estado.filasLeidas} filas leídas · {data.estado.incorporados} incorporadas.</p>}
                {data.estado.error && <p role="alert">Último error: {data.estado.error}</p>}
                <button className={`btn ${data.config.activo ? 'btn-secondary' : 'btn-primary'}`} disabled={ocupado} onClick={() => void cambiarEstado(!data.config.activo)}>{data.config.activo ? 'Pausar integración' : 'Activar integración'}</button>
            </section>

            <section><h2>Destino por sucursal</h2><p>Escribí exactamente el valor que aparece en la columna Ubicación. Efectivo y Transferencia pueden ir a cajas diferentes.</p>
                <div className="table-container"><table className="table"><thead><tr><th>Ubicación en Sheet</th><th>Sede</th><th>Efectivo</th><th>Transferencia</th><th>Activa</th></tr></thead><tbody>
                    {sucursales.map((fila, indice) => <tr key={fila.id || `nueva-${indice}`}>
                        <td><input className="form-input" required value={fila.ubicacionTexto} onChange={e => actualizar(indice, { ubicacionTexto: e.target.value })} /></td>
                        <td><select className="form-select" value={fila.ubicacionId} onChange={e => actualizar(indice, { ubicacionId: e.target.value, cajaEfectivoId: null })}><option value="">Seleccionar</option>{sedes?.filter(s => s.activo && s.tipo === 'LOCAL').map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></td>
                        <td><select className="form-select" value={fila.cajaEfectivoId || ''} onChange={e => actualizar(indice, { cajaEfectivoId: e.target.value || null })}><option value="">Sin configurar</option>{cajasActivas.filter(c => c.ubicacionId === fila.ubicacionId).map(c => <option key={c.id} value={c.id}>{c.nombre || c.tipo}</option>)}</select></td>
                        <td><select className="form-select" value={fila.cajaTransferenciaId || ''} onChange={e => actualizar(indice, { cajaTransferenciaId: e.target.value || null })}><option value="">Sin configurar</option>{cajasActivas.map(c => <option key={c.id} value={c.id}>{c.nombre || c.tipo}{c.ubicacion?.nombre ? ` · ${c.ubicacion.nombre}` : ''}</option>)}</select></td>
                        <td><input type="checkbox" checked={fila.activo} onChange={e => actualizar(indice, { activo: e.target.checked })} /></td>
                    </tr>)}
                    {!sucursales.length && <tr><td colSpan={5}>Agregá la primera relación entre el Sheet y una sede.</td></tr>}
                </tbody></table></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="btn btn-secondary" disabled={ocupado} onClick={() => setSucursales([...sucursales, { ubicacionTexto: '', ubicacionId: '', cajaEfectivoId: null, cajaTransferenciaId: null, activo: true }])}>+ Agregar ubicación</button>
                    <button className="btn btn-primary" disabled={ocupado || !sucursales.length} onClick={() => void guardar()}>Guardar destinos</button></div>
            </section>

            <section style={{ marginTop: 28 }}><h2>Pedidos leídos</h2><p>{data.totalesPorHoja.map(t => `${t.hoja}: ${t._count._all}`).join(' · ')}. Se muestran también los pendientes y los anteriores a la activación.</p><div className="table-container"><table className="table"><thead><tr><th>Pedido</th><th>Hoja</th><th>Estado Sheet</th><th>Ubicación</th><th>Pago</th><th>Importe</th><th>Resultado</th></tr></thead><tbody>
                {data.recientes.map(r => <tr key={r.id}><td>#{r.externalId}</td><td>{r.hoja}</td><td>{r.estadoFuente || '—'}</td><td>{r.ubicacion || '—'}</td><td>{r.pago || '—'}</td><td>{r.precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td><td>{resultadoVisible(r)}{r.detalle && <small style={{ display: 'block' }}>{r.detalle}</small>}</td></tr>)}
                {!data.recientes.length && <tr><td colSpan={7}>Todavía no hay movimientos procesados.</td></tr>}
            </tbody></table></div></section>
        </>}
    </div>
}
