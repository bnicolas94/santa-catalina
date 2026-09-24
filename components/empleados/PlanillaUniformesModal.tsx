'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { UniformesTab } from './UniformesTab'
import { ConfiguracionUniformes } from './ConfiguracionUniformes'

type Empleado = { id: string; nombre: string; apellido: string | null; ubicacionId: string | null }
type Stock = { id: string; prenda: 'REMERA' | 'BUZO'; talle: string; cantidad: number }
type Movimiento = {
    id: string; tipo: string; delta: number; saldoPosterior: number; motivo: string | null; createdAt: string
    stock: { prenda: 'REMERA' | 'BUZO'; talle: string }
    registradoPor: { nombre: string; apellido: string | null }
    entrega: { id: string; empleado: { nombre: string; apellido: string | null } } | null
}

export function PlanillaUniformesModal({ onClose }: { onClose: () => void }) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [stock, setStock] = useState<Stock[]>([])
    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [empleadoId, setEmpleadoId] = useState('')
    const [pestana, setPestana] = useState<'entregas' | 'stock' | 'configuracion'>('entregas')
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')
    const [prenda, setPrenda] = useState<'REMERA' | 'BUZO'>('REMERA')
    const [talle, setTalle] = useState('')
    const [delta, setDelta] = useState(1)
    const [motivo, setMotivo] = useState('')

    const cargar = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const respuestas = await Promise.all([
                fetch('/api/uniformes'), fetch('/api/uniformes/stock'), fetch('/api/uniformes/movimientos'),
            ])
            if (respuestas.some(respuesta => !respuesta.ok)) throw new Error('No se pudo cargar la ropa de trabajo.')
            const [datosEmpleados, datosStock, datosMovimientos] = await Promise.all(respuestas.map(respuesta => respuesta.json()))
            setEmpleados(datosEmpleados)
            setStock(datosStock)
            setMovimientos(datosMovimientos)
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la ropa de trabajo.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void cargar() }, [cargar])

    const empleadosFiltrados = useMemo(() => empleados.filter(empleado =>
        `${empleado.nombre} ${empleado.apellido || ''}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es')),
    ), [empleados, busqueda])

    async function registrarMovimiento(evento: React.FormEvent) {
        evento.preventDefault()
        setGuardando(true)
        setError('')
        try {
            const respuesta = await fetch('/api/uniformes/stock', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prenda, talle, delta, motivo }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo actualizar el stock.')
            setTalle('')
            setDelta(1)
            setMotivo('')
            await cargar()
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo actualizar el stock.')
        } finally {
            setGuardando(false)
        }
    }

    return <div className="modal-overlay" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label="Ropa de trabajo" style={{ maxWidth: 1100, width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header"><h2>Ropa de trabajo</h2><button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar">×</button></div>
        <div className="modal-body" style={{ overflow: 'auto' }}>
            {error && <div role="alert" className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button type="button" className={`btn ${pestana === 'entregas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPestana('entregas')}>Entregas</button>
                <button type="button" className={`btn ${pestana === 'stock' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setPestana('stock'); void cargar() }}>Stock y movimientos</button>
                <button type="button" className={`btn ${pestana === 'configuracion' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPestana('configuracion')}>Configuración 299/11</button>
            </div>
            {loading ? <p>Cargando ropa de trabajo...</p> : pestana === 'configuracion' ? <ConfiguracionUniformes /> : pestana === 'entregas' ? <div style={{ display: 'grid', gap: 16 }}>
                <label className="form-control"><span className="label">Buscar empleado</span><input className="input" value={busqueda} onChange={evento => setBusqueda(evento.target.value)} placeholder="Nombre o apellido" /></label>
                <label className="form-control"><span className="label">Empleado</span><select className="input" value={empleadoId} onChange={evento => setEmpleadoId(evento.target.value)}>
                    <option value="">Seleccionar empleado</option>
                    {empleadosFiltrados.map(empleado => <option key={empleado.id} value={empleado.id}>{empleado.nombre} {empleado.apellido}</option>)}
                </select></label>
                {empleadoId ? <UniformesTab key={empleadoId} empleadoId={empleadoId} /> : <p>Seleccioná un empleado para consultar o registrar sus entregas.</p>}
            </div> : <div style={{ display: 'grid', gap: 24 }}>
                {esAdmin && <form onSubmit={registrarMovimiento} className="card"><div className="card-body" style={{ display: 'grid', gap: 12 }}>
                    <h3>Ingreso o ajuste de stock</h3>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label className="form-control"><span className="label">Prenda</span><select className="input" value={prenda} onChange={evento => setPrenda(evento.target.value as 'REMERA' | 'BUZO')}><option value="REMERA">Remera</option><option value="BUZO">Buzo</option></select></label>
                        <label className="form-control"><span className="label">Talle</span><input className="input" required maxLength={20} value={talle} onChange={evento => setTalle(evento.target.value)} placeholder="M, L, XL..." /></label>
                        <label className="form-control"><span className="label">Cambio en unidades</span><input className="input" type="number" required step={1} value={delta} onChange={evento => setDelta(Number(evento.target.value))} title="Positivo para ingresar, negativo para descontar" /></label>
                    </div>
                    <label className="form-control"><span className="label">Motivo</span><input className="input" required maxLength={500} value={motivo} onChange={evento => setMotivo(evento.target.value)} placeholder="Compra, conteo físico, corrección..." /></label>
                    <p>Usá un número positivo para ingresar prendas y negativo para ajustar una diferencia.</p>
                    <div><button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar movimiento'}</button></div>
                </div></form>}
                <section><h3>Existencias</h3>{stock.length === 0 ? <p>Todavía no hay prendas cargadas.</p> : <div className="table-container"><table className="table"><thead><tr><th>Prenda</th><th>Talle</th><th>Disponible</th></tr></thead><tbody>{stock.map(item => <tr key={item.id}><td>{item.prenda === 'REMERA' ? 'Remera' : 'Buzo'}</td><td>{item.talle}</td><td>{item.cantidad}</td></tr>)}</tbody></table></div>}</section>
                <section><h3>Últimos movimientos</h3>{movimientos.length === 0 ? <p>No hay movimientos.</p> : <div className="table-container"><table className="table"><thead><tr><th>Fecha</th><th>Prenda</th><th>Movimiento</th><th>Saldo</th><th>Responsable</th><th>Motivo</th></tr></thead><tbody>{movimientos.map(item => <tr key={item.id}>
                    <td>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Buenos_Aires' }).format(new Date(item.createdAt))}</td>
                    <td>{item.stock.prenda === 'REMERA' ? 'Remera' : 'Buzo'} · {item.stock.talle}</td><td>{item.tipo} ({item.delta > 0 ? '+' : ''}{item.delta})</td><td>{item.saldoPosterior}</td>
                    <td>{item.registradoPor.nombre} {item.registradoPor.apellido}</td><td>{item.motivo || (item.entrega ? `Entrega a ${item.entrega.empleado.nombre} ${item.entrega.empleado.apellido || ''}` : '—')}</td>
                </tr>)}</tbody></table></div>}</section>
            </div>}
        </div>
    </section></div>
}
