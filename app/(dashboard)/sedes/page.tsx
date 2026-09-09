'use client'

import { useState } from 'react'
import useSWR from 'swr'

interface Sede { id: string; nombre: string; tipo: string; activo: boolean }
const inicial = { nombre: '', tipo: 'FABRICA', activo: true }

async function cargar(url: string): Promise<Sede[]> {
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudieron cargar las sedes')
    return data
}

export default function SedesPage() {
    const { data: sedes, error: errorCarga, isLoading, mutate } = useSWR('/api/sedes', cargar)
    const [edicion, setEdicion] = useState<string | null>(null)
    const [abierto, setAbierto] = useState(false)
    const [form, setForm] = useState(inicial)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [estado, setEstado] = useState('todas')

    async function guardar(datos: typeof inicial & { id?: string }) {
        setGuardando(true)
        setError('')
        setMensaje('')
        try {
            const res = await fetch('/api/sedes', {
                method: datos.id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar la sede')
            await mutate(actuales => datos.id
                ? actuales?.map(sede => sede.id === data.id ? data : sede)
                : [...(actuales || []), data].sort((a, b) => a.nombre.localeCompare(b.nombre)), { revalidate: false })
            setAbierto(false)
            setMensaje('Sede guardada correctamente')
        } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar') }
        finally { setGuardando(false) }
    }

    const visibles = (sedes || []).filter(sede => sede.nombre.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())
        && (estado === 'todas' || sede.activo === (estado === 'activas')))

    return <div>
        <div className="page-header">
            <div><h1>📍 Sedes</h1><p>Administrá las fábricas y los locales de la empresa.</p></div>
            <button className="btn btn-primary" disabled={guardando} onClick={() => {
                setEdicion(null); setForm(inicial); setError(''); setMensaje(''); setAbierto(true)
            }}>+ Nueva sede</button>
        </div>
        <p>Desactivar una sede conserva su historial y la retira de los listados de sedes disponibles. Podés reactivarla cuando lo necesites.</p>
        {(error || errorCarga) && <div role="alert" className="toast toast-error">{error || errorCarga.message}</div>}
        {mensaje && <div role="status" className="toast toast-success">{mensaje}</div>}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '20px 0' }}>
            <label>Buscar sede<input className="form-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre de la sede" /></label>
            <label>Estado<select className="form-input" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="todas">Todas</option><option value="activas">Activas</option><option value="inactivas">Inactivas</option>
            </select></label>
        </div>
        {isLoading ? <p role="status">Cargando sedes...</p> : errorCarga ? <button className="btn" onClick={() => mutate()}>Reintentar</button> :
            <div className="table-container"><table className="table">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{visibles.map(sede => <tr key={sede.id}>
                    <td>{sede.nombre}</td><td>{sede.tipo === 'FABRICA' ? '🏭 Fábrica' : sede.tipo === 'LOCAL' ? '🏪 Local' : sede.tipo}</td>
                    <td>{sede.activo ? 'Activa' : 'Inactiva'}</td>
                    <td><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" disabled={guardando} onClick={() => {
                            setEdicion(sede.id); setForm({ nombre: sede.nombre, tipo: sede.tipo, activo: sede.activo }); setError(''); setMensaje(''); setAbierto(true)
                        }}>Editar</button>
                        <button className="btn btn-sm btn-ghost" disabled={guardando} onClick={() => {
                            if (sede.activo && !confirm(`¿Desactivar ${sede.nombre}? Se conservará su historial. Revisá las operaciones pendientes y las asignaciones de personal antes de continuar.`)) return
                            void guardar({ ...sede, activo: !sede.activo })
                        }}>{sede.activo ? 'Desactivar' : 'Reactivar'}</button>
                    </div></td>
                </tr>)}{visibles.length === 0 && <tr><td colSpan={4}>No hay sedes para mostrar.</td></tr>}</tbody>
            </table></div>}
        {abierto && <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-sede" style={{ maxWidth: 520 }}>
            <div className="modal-header"><h2 id="titulo-sede">{edicion ? 'Editar sede' : 'Nueva sede'}</h2>
                <button className="btn btn-ghost" aria-label="Cerrar" disabled={guardando} onClick={() => setAbierto(false)}>✕</button></div>
            <form className="modal-body" onSubmit={e => { e.preventDefault(); void guardar({ ...form, ...(edicion ? { id: edicion } : {}) }) }}>
                {error && <p role="alert">{error}</p>}
                <label className="form-group">Nombre<input autoFocus className="form-input" required maxLength={100} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
                <label className="form-group">Tipo<select className="form-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="FABRICA">Fábrica</option><option value="LOCAL">Local</option>
                </select></label>
                {edicion && <p>El tipo sólo puede cambiarse si la sede todavía no tiene registros asociados.</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                    <button type="button" className="btn btn-secondary" disabled={guardando} onClick={() => setAbierto(false)}>Cancelar</button></div>
            </form>
        </div></div>}
    </div>
}
