'use client'
import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'

interface Sede { id: string; nombre: string; activo: boolean }
interface Caja { id: string; tipo: string; nombre: string | null; saldo: number; activo: boolean; sistema: boolean; ubicacionId: string | null; ubicacion: Sede | null; recibeDepositos: boolean; conceptoDeposito: string }
const inicial = { nombre: '', ubicacionId: '', activo: true, recibeDepositos: false, conceptoDeposito: 'Depósito diario' }
async function cargar<T,>(url: string): Promise<T> {
    const res = await fetch(url); const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudo cargar la información.')
    return data
}
const moneda = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export default function CajasPage() {
    const { data: cajas, error: errorCarga, isLoading, mutate } = useSWR('/api/cajas', cargar<Caja[]>)
    const { data: sedes, error: errorSedes } = useSWR('/api/sedes', cargar<Sede[]>)
    const [filtroSede, setFiltroSede] = useState('todas')
    const [busqueda, setBusqueda] = useState('')
    const [estado, setEstado] = useState('todas')
    const [edicion, setEdicion] = useState<Caja | null>(null)
    const [form, setForm] = useState(inicial)
    const [abierto, setAbierto] = useState(false)
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    async function guardar(datos: typeof inicial, caja?: Caja | null) {
        setOcupado(true); setError(''); setMensaje('')
        try {
            const res = await fetch('/api/cajas', { method: caja ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...datos, ubicacionId: datos.ubicacionId || null, ...(caja ? { id: caja.id } : {}) }) })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar la caja.')
            await mutate(); setAbierto(false); setMensaje('Caja guardada. Ya está disponible en Caja para la sede seleccionada.')
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.') }
        finally { setOcupado(false) }
    }
    const visibles = (cajas || []).filter(c => (filtroSede === 'todas' || (c.ubicacionId || 'sin-sede') === filtroSede) &&
        (estado === 'todas' || c.activo === (estado === 'activas')) && (c.nombre || c.tipo).toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()))
    return <div>
        <div className="page-header"><div><h1>Cajas por sede</h1><p>Creá las cajas de cada local o fábrica y elegí dónde se reciben sus depósitos.</p></div>
            <div style={{ display: 'flex', gap: 8 }}><Link className="btn btn-secondary" href="/caja">Ver movimientos</Link><Link className="btn btn-secondary" href="/cajas/google-sheets">Integración Google Sheets</Link>
                <button className="btn btn-primary" disabled={ocupado || !sedes?.some(s => s.activo)} onClick={() => {
                    setEdicion(null); setForm({ ...inicial, ubicacionId: filtroSede !== 'todas' && filtroSede !== 'sin-sede' ? filtroSede : '' }); setError(''); setAbierto(true)
                }}>+ Nueva caja</button></div></div>
        <p>Las cajas nuevas comienzan en $0. El saldo se modifica desde Caja mediante movimientos, transferencias o ajustes con auditoría.</p>
        {!!cajas?.some(c => !c.ubicacionId && !c.tipo.startsWith('mercado_pago')) && <p role="status">Hay cajas existentes sin sede vinculada. Editalas para asignarlas; mientras tanto, sólo las ve Administración.</p>}
        {(error || errorCarga || errorSedes) && <p role="alert" className="toast toast-error">{error || errorCarga?.message || errorSedes?.message}</p>}
        {mensaje && <p role="status" className="toast toast-success">{mensaje}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '20px 0' }}>
            <label>Buscar<input className="form-input" placeholder="Nombre de caja" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
            <label>Sede<select className="form-select" value={filtroSede} onChange={e => setFiltroSede(e.target.value)}><option value="todas">Todas las sedes</option><option value="sin-sede">Sin sede / centrales</option>{sedes?.map(s => <option key={s.id} value={s.id}>{s.nombre}{s.activo ? '' : ' (inactiva)'}</option>)}</select></label>
            <label>Estado<select className="form-select" value={estado} onChange={e => setEstado(e.target.value)}><option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option></select></label>
        </div>
        {isLoading ? <p>Cargando cajas…</p> : <div className="table-container"><table className="table"><thead><tr><th>Caja</th><th>Sede</th><th>Saldo</th><th>Depósitos diarios</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
            {visibles.map(c => <tr key={c.id}><td>{c.nombre || c.tipo}{c.sistema && <small style={{ display: 'block' }}>Utilizada por otros módulos</small>}</td><td>{c.ubicacion?.nombre || 'Sin sede / central'}</td><td>{moneda(c.saldo)}</td><td>{c.recibeDepositos ? 'Recibe depósitos' : '—'}</td><td>{c.activo ? c.ubicacion && !c.ubicacion.activo ? 'Sede inactiva' : 'Activa' : 'Inactiva'}</td><td>
                <button className="btn btn-sm btn-secondary" disabled={ocupado} onClick={() => { setEdicion(c); setForm({ nombre: c.nombre || c.tipo, ubicacionId: c.ubicacionId || '', activo: c.activo, recibeDepositos: c.recibeDepositos, conceptoDeposito: c.conceptoDeposito }); setError(''); setAbierto(true) }}>Editar</button>
                {!c.sistema && <button className="btn btn-sm btn-ghost" disabled={ocupado} onClick={() => {
                    if (c.activo && !confirm(`¿Desactivar ${c.nombre}? Se conservarán los movimientos y podrás reactivarla.`)) return
                    void guardar({ nombre: c.nombre || c.tipo, ubicacionId: c.ubicacionId || '', activo: !c.activo, recibeDepositos: c.recibeDepositos, conceptoDeposito: c.conceptoDeposito }, c)
                }}>{c.activo ? 'Desactivar' : 'Reactivar'}</button>}
            </td></tr>)}{!visibles.length && <tr><td colSpan={6}>No hay cajas con estos filtros.</td></tr>}
        </tbody></table></div>}
        {abierto && <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-caja" style={{ maxWidth: 540 }}>
            <div className="modal-header"><h2 id="titulo-caja">{edicion ? 'Editar caja' : 'Nueva caja'}</h2><button className="btn btn-ghost" disabled={ocupado} aria-label="Cerrar" onClick={() => setAbierto(false)}>✕</button></div>
            <form className="modal-body" onSubmit={e => { e.preventDefault(); void guardar(form, edicion) }}>
                {error && <p role="alert">{error}</p>}
                <label className="form-group">Nombre<input autoFocus required maxLength={100} className="form-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej.: Caja mostrador — Local Centro" /></label>
                <label className="form-group">Sede<select required={!edicion} className="form-select" value={form.ubicacionId} onChange={e => setForm({ ...form, ubicacionId: e.target.value })}><option value="">{edicion ? 'Sin sede / central (sólo Administración)' : 'Seleccioná una sede'}</option>{sedes?.filter(s => s.activo || s.id === form.ubicacionId).map(s => <option key={s.id} value={s.id}>{s.nombre}{s.activo ? '' : ' (inactiva)'}</option>)}</select></label>
                <label><input type="checkbox" checked={form.recibeDepositos} onChange={e => setForm({ ...form, recibeDepositos: e.target.checked })} /> Recibir los depósitos diarios de esta sede</label>
                {form.recibeDepositos && <label className="form-group">Concepto del depósito<input required maxLength={100} className="form-input" value={form.conceptoDeposito} onChange={e => setForm({ ...form, conceptoDeposito: e.target.value })} /></label>}
                <p>Cada sede puede tener varias cajas y una caja para sus depósitos diarios. La vinculación no mueve dinero.</p>
                <div className="form-actions"><button className="btn btn-primary" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar caja'}</button><button type="button" className="btn btn-secondary" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</button></div>
            </form></div></div>}
    </div>
}
