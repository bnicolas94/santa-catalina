'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { fechaClaveRRHH } from '@/lib/rrhh/fechas'

type Prenda = 'REMERA' | 'BUZO'
type Stock = { id: string; prenda: Prenda; talle: string; cantidad: number; tipoModelo: string | null; marca: string | null; certificado: boolean | null }
type Entrega = {
    id: string
    fecha: string
    observaciones: string | null
    estado: string
    motivoAnulacion: string | null
    registradoPor: { nombre: string; apellido: string | null } | null
    detalles: { prenda: Prenda; talle: string; cantidad: number }[]
    remera: number
    buzo: number
}
type Linea = { stockId: string; cantidad: number }

function fechaVisible(valor: string) {
    const [anio, mes, dia] = fechaClaveRRHH(valor).split('-')
    return `${dia}/${mes}/${anio}`
}

export function UniformesTab({ empleadoId }: { empleadoId: string }) {
    const { data: session } = useSession()
    const esAdmin = (session?.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const [talles, setTalles] = useState({ remera: '', buzo: '' })
    const [entregas, setEntregas] = useState<Entrega[]>([])
    const [stock, setStock] = useState<Stock[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [mostrarFormulario, setMostrarFormulario] = useState(false)
    const [fecha, setFecha] = useState(() => fechaClaveRRHH(new Date()))
    const [observaciones, setObservaciones] = useState('')
    const [lineas, setLineas] = useState<Linea[]>([{ stockId: '', cantidad: 1 }])
    const [claveOperacion, setClaveOperacion] = useState(() => crypto.randomUUID())

    const cargar = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const respuestas = await Promise.all([
                fetch(`/api/empleados/${empleadoId}/uniformes/talles`),
                fetch(`/api/empleados/${empleadoId}/uniformes/entregas`),
                fetch('/api/uniformes/stock'),
            ])
            if (respuestas.some(respuesta => !respuesta.ok)) throw new Error('No se pudieron cargar los uniformes.')
            const [datosTalles, datosEntregas, datosStock] = await Promise.all(respuestas.map(respuesta => respuesta.json()))
            setTalles({ remera: datosTalles.remera || '', buzo: datosTalles.buzo || '' })
            setEntregas(datosEntregas)
            setStock(datosStock)
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudieron cargar los uniformes.')
        } finally {
            setLoading(false)
        }
    }, [empleadoId])

    useEffect(() => { void cargar() }, [cargar])

    async function guardarTalles() {
        setGuardando(true)
        setError('')
        try {
            const respuesta = await fetch(`/api/empleados/${empleadoId}/uniformes/talles`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(talles),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron guardar los talles.')
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudieron guardar los talles.')
        } finally {
            setGuardando(false)
        }
    }

    function cambiarLinea(indice: number, cambio: Partial<Linea>) {
        setLineas(actuales => actuales.map((linea, posicion) => posicion === indice ? { ...linea, ...cambio } : linea))
    }

    async function registrarEntrega(evento: React.FormEvent) {
        evento.preventDefault()
        setError('')
        setGuardando(true)
        try {
            const detalles = lineas.map(linea => {
                const variante = stock.find(item => item.id === linea.stockId)
                if (!variante) throw new Error('Seleccioná una prenda y talle en cada línea.')
                return { prenda: variante.prenda, talle: variante.talle, cantidad: linea.cantidad }
            })
            const respuesta = await fetch(`/api/empleados/${empleadoId}/uniformes/entregas`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, observaciones, detalles, claveIdempotencia: claveOperacion }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo registrar la entrega.')
            setMostrarFormulario(false)
            setLineas([{ stockId: '', cantidad: 1 }])
            setObservaciones('')
            setFecha(fechaClaveRRHH(new Date()))
            setClaveOperacion(crypto.randomUUID())
            await cargar()
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo registrar la entrega.')
        } finally {
            setGuardando(false)
        }
    }

    async function anularEntrega(entregaId: string) {
        const motivo = window.prompt('Motivo de anulación de la entrega:')?.trim()
        if (!motivo) return
        setGuardando(true)
        setError('')
        try {
            const respuesta = await fetch(`/api/empleados/${empleadoId}/uniformes/entregas/${entregaId}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
            })
            const datos = await respuesta.json()
            if (!respuesta.ok) throw new Error(datos.error || 'No se pudo anular la entrega.')
            await cargar()
        } catch (fallo) {
            setError(fallo instanceof Error ? fallo.message : 'No se pudo anular la entrega.')
        } finally {
            setGuardando(false)
        }
    }

    if (loading) return <div className="p-4 text-center">Cargando uniformes...</div>

    return <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {error && <div role="alert" className="alert alert-error">{error}</div>}
        <section className="card"><div className="card-body">
            <h3>Talles habituales</h3>
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}>
                {(['remera', 'buzo'] as const).map(prenda => <label key={prenda} className="form-control">
                    <span className="label">Talle {prenda}</span>
                    <input className="input" value={talles[prenda]} disabled={!esAdmin || guardando}
                        onChange={evento => setTalles(actual => ({ ...actual, [prenda]: evento.target.value }))} />
                </label>)}
                {esAdmin && <button type="button" className="btn btn-primary" disabled={guardando} onClick={guardarTalles}>Guardar talles</button>}
            </div>
        </div></section>

        <section className="card"><div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <h3>Entregas de ropa</h3>
                {esAdmin && <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => window.open(`/empleados/${empleadoId}/uniformes/imprimir`, '_blank')}>Constancia 299/11</button>
                    <button type="button" className="btn btn-primary" onClick={() => setMostrarFormulario(true)}>Registrar entrega</button>
                </div>}
            </div>
            {entregas.length === 0 ? <p>No hay entregas registradas.</p> : <div className="table-container"><table className="table">
                <thead><tr><th>Fecha</th><th>Prendas entregadas</th><th>Observaciones</th><th>Responsable</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{entregas.map(entrega => <tr key={entrega.id}>
                    <td>{fechaVisible(entrega.fecha)}</td>
                    <td>{entrega.detalles.length
                        ? entrega.detalles.map(item => `${item.cantidad} ${item.prenda === 'REMERA' ? 'remera' : 'buzo'} talle ${item.talle}`).join(', ')
                        : `Histórico sin detalle de talle: ${entrega.remera} remera(s), ${entrega.buzo} buzo(s)`}</td>
                    <td>{entrega.observaciones || '—'}</td>
                    <td>{entrega.registradoPor ? `${entrega.registradoPor.nombre} ${entrega.registradoPor.apellido || ''}` : 'Sin registro'}</td>
                    <td>{entrega.estado === 'ANULADA' ? `Anulada: ${entrega.motivoAnulacion || ''}` : 'Activa'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                        {esAdmin && entrega.estado === 'ACTIVA' && <button type="button" className="btn btn-sm btn-ghost"
                            disabled={guardando} onClick={() => void anularEntrega(entrega.id)}>Anular</button>}
                    </td>
                </tr>)}</tbody>
            </table></div>}
        </div></section>

        {mostrarFormulario && esAdmin && <div className="modal-overlay" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label="Registrar entrega de ropa" style={{ maxWidth: 640, width: '95vw' }}>
            <div className="modal-header"><h3>Registrar entrega de ropa</h3><button type="button" className="btn-close" onClick={() => setMostrarFormulario(false)} aria-label="Cerrar">×</button></div>
            <form onSubmit={registrarEntrega} className="modal-body" style={{ display: 'grid', gap: 16 }}>
                {error && <div role="alert" className="alert alert-error">{error}</div>}
                <label className="form-control"><span className="label">Fecha de entrega</span><input type="date" className="input" required value={fecha} onChange={evento => setFecha(evento.target.value)} /></label>
                {lineas.map((linea, indice) => <div key={indice} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                    <label className="form-control" style={{ flex: 1, minWidth: 180 }}><span className="label">Prenda y talle</span>
                        <select className="input" required value={linea.stockId} onChange={evento => cambiarLinea(indice, { stockId: evento.target.value })}>
                            <option value="">Seleccionar</option>
                            {stock.filter(item => item.cantidad > 0).map(item => <option key={item.id} value={item.id} disabled={!item.tipoModelo || !item.marca || item.certificado === null}>{item.prenda === 'REMERA' ? 'Remera' : 'Buzo'} · {item.talle} · disponible {item.cantidad}{!item.tipoModelo || !item.marca || item.certificado === null ? ' · configurar ficha' : ''}</option>)}
                        </select>
                    </label>
                    <label className="form-control"><span className="label">Cantidad</span><input type="number" className="input" min={1} step={1} required style={{ width: 100 }} value={linea.cantidad} onChange={evento => cambiarLinea(indice, { cantidad: Number(evento.target.value) })} /></label>
                    {lineas.length > 1 && <button type="button" className="btn btn-ghost" onClick={() => setLineas(actuales => actuales.filter((_, posicion) => posicion !== indice))}>Quitar</button>}
                </div>)}
                <button type="button" className="btn btn-ghost" disabled={lineas.length >= 20} onClick={() => setLineas(actuales => [...actuales, { stockId: '', cantidad: 1 }])}>+ Agregar prenda</button>
                <label className="form-control"><span className="label">Observaciones</span><textarea className="input" maxLength={500} value={observaciones} onChange={evento => setObservaciones(evento.target.value)} /></label>
                <p>Al confirmar se descontará el stock. El comprobante podrá imprimirse desde el historial.</p>
                <div style={{ display: 'flex', justifyContent: 'end', gap: 8 }}><button type="button" className="btn btn-ghost" onClick={() => setMostrarFormulario(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Registrando...' : 'Confirmar entrega'}</button></div>
            </form>
        </section></div>}
    </div>
}
