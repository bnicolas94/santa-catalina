'use client'

import { useState, useEffect } from 'react'

interface Cliente { id: string; nombreComercial: string; zona?: string; direccion?: string; latitud?: number; longitud?: number }
interface DetallePedido { 
    cantidad: number; 
    presentacion?: { 
        id: string;
        productoId: string;
        cantidad: number; 
        producto?: { id: string; codigoInterno: string; nombre: string } 
    } 
}
interface Pedido {
    id: string; fechaPedido: string; fechaEntrega: string; estado: string
    turno?: string | null
    totalUnidades: number; totalImporte: number
    cliente: Cliente; detalles: DetallePedido[]
}
interface Empleado { id: string; nombre: string; rol: string }
interface Entrega {
    id: string; horaEntrega: string | null; tempEntrega: number | null
    unidadesRechazadas: number; motivoRechazo: string | null; observaciones: string | null
    cliente: Cliente; pedido: Pedido
}
interface Ruta {
    id: string; fecha: string; zona: string; turno?: string
    chofer: { nombre: string }; entregas: Entrega[]
    ubicacionOrigenId?: string; ubicacionOrigen?: { nombre: string }
}
interface Ubicacion { id: string; nombre: string; tipo: string }
interface StockInfo { [key: string]: number }

interface RoutePlanPedido {
    pedidoId: string; clienteId: string; clienteNombre: string
    direccion: string; lat: number | null; lng: number | null; orden: number
}
interface RoutePlanSinCoords {
    pedidoId: string; clienteId: string; clienteNombre: string; direccion: string
}
interface RoutePlan {
    choferId: string; choferNombre: string
    pedidos: RoutePlanPedido[]
    totalDistance?: number; totalDuration?: number
    sinCoordenadas: RoutePlanSinCoords[]
}

function getLocalDateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function PlanificacionRutasPage() {
    const [pedidosDisponibles, setPedidosDisponibles] = useState<Pedido[]>([])
    const [choferes, setChoferes] = useState<Empleado[]>([])
    const [rutas, setRutas] = useState<Ruta[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [isOptimizing, setIsOptimizing] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [filterFecha, setFilterFecha] = useState(getLocalDateString())
    const [expandedRutas, setExpandedRutas] = useState<Record<string, boolean>>({})

    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
    const [stockActual, setStockActual] = useState<StockInfo>({})

    // Form state
    const [formRuta, setFormRuta] = useState({ 
        fecha: getLocalDateString(), turno: 'Mañana', ubicacionOrigenId: '' 
    })
    const [pedidosSeleccionados, setPedidosSeleccionados] = useState<string[]>([])
    const [choferesSeleccionados, setChoferesSeleccionados] = useState<string[]>([])
    const [maxParadas, setMaxParadas] = useState(15)

    // Auto-assign preview
    const [routePreview, setRoutePreview] = useState<RoutePlan[] | null>(null)
    const [previewStats, setPreviewStats] = useState<{ conCoords: number; sinCoords: number } | null>(null)

    useEffect(() => { fetchData() }, [filterFecha])

    async function fetchData() {
        try {
            const params = filterFecha ? `?fecha=${filterFecha}` : ''
            const [pedRes, empRes, rutaRes, ubiRes, planRes] = await Promise.all([
                fetch('/api/pedidos'),
                fetch('/api/empleados'),
                fetch(`/api/rutas${params}`),
                fetch('/api/ubicaciones'),
                fetch(`/api/produccion/planificacion?fecha=${filterFecha || getLocalDateString()}`)
            ])
            const pedData = await pedRes.json()
            const empData = await empRes.json()
            const rutaData = await rutaRes.json()
            const ubiData = await ubiRes.json()
            const planData = await planRes.json()

            // Solo pedidos confirmados
            const disponibles = Array.isArray(pedData)
                ? pedData.filter((p: Pedido) => p.estado === 'confirmado')
                : []
            setPedidosDisponibles(disponibles)

            const soloChoferes = Array.isArray(empData)
                ? empData.filter((e: Empleado) => e.rol === 'LOGISTICA' || e.rol === 'ADMIN')
                : []
            setChoferes(soloChoferes)
            setRutas(Array.isArray(rutaData) ? rutaData : [])
            
            const ubis = Array.isArray(ubiData) ? ubiData : []
            setUbicaciones(ubis)
            
            if (!formRuta.ubicacionOrigenId && ubis.length > 0) {
                const defaultUbi = ubis.find((u: Ubicacion) => u.tipo === 'FABRICA') || ubis[0]
                setFormRuta(prev => ({ ...prev, ubicacionOrigenId: defaultUbi.id }))
            }

            const combinedStock: StockInfo = {}
            if (planData.stockFabricacion) Object.assign(combinedStock, planData.stockFabricacion)
            if (planData.stockLocal) {
                Object.entries(planData.stockLocal).forEach(([k, v]: [string, unknown]) => {
                    combinedStock[k] = (combinedStock[k] || 0) + (v as number)
                })
            }
            setStockActual(combinedStock)
        } catch { setError('Error al cargar datos') } finally { setLoading(false) }
    }

    const togglePedido = (pedidoId: string) => {
        setPedidosSeleccionados(prev =>
            prev.includes(pedidoId) ? prev.filter(id => id !== pedidoId) : [...prev, pedidoId]
        )
    }

    const toggleChofer = (choferId: string) => {
        setChoferesSeleccionados(prev =>
            prev.includes(choferId) ? prev.filter(id => id !== choferId) : [...prev, choferId]
        )
    }

    // Auto-assign: Preview
    async function handleAutoAssignPreview() {
        if (!pedidosSeleccionados.length || !choferesSeleccionados.length) {
            setError('Seleccioná pedidos y al menos un chofer')
            return
        }
        setIsOptimizing(true)
        setError('')
        try {
            const res = await fetch('/api/rutas/auto-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pedidoIds: pedidosSeleccionados,
                    choferIds: choferesSeleccionados,
                    fecha: formRuta.fecha,
                    turno: formRuta.turno,
                    ubicacionOrigenId: formRuta.ubicacionOrigenId,
                    maxParadasPorChofer: maxParadas,
                    mode: 'preview'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setRoutePreview(data.routePlans)
            setPreviewStats({ conCoords: data.conCoordenadas, sinCoords: data.sinCoordenadas })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al optimizar')
        } finally { setIsOptimizing(false) }
    }

    // Auto-assign: Confirm
    async function handleAutoAssignConfirm() {
        if (!routePreview) return
        setIsOptimizing(true)
        setError('')
        try {
            const res = await fetch('/api/rutas/auto-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: formRuta.fecha,
                    turno: formRuta.turno,
                    ubicacionOrigenId: formRuta.ubicacionOrigenId,
                    routePlans: routePreview,
                    mode: 'confirm-plans'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(`${data.rutasCreadas} rutas creadas con éxito (Stock descontado)`)
            setShowModal(false)
            setRoutePreview(null)
            setPedidosSeleccionados([])
            setChoferesSeleccionados([])
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al crear rutas')
        } finally { setIsOptimizing(false) }
    }

    async function handleFixCoords() {
        if (!confirm('¿Buscar coordenadas para todos los clientes sin ubicación?')) return
        try {
            const res = await fetch('/api/admin/geocode-all', { method: 'POST' })
            const data = await res.json()
            alert(data.mensaje || 'Proceso finalizado')
            fetchData()
        } catch { alert('Error al procesar coordenadas') }
    }

    async function handleDeleteRuta(rutaId: string) {
        if (!confirm('¿Eliminar esta ruta? Los pedidos no entregados volverán a "confirmado" y el stock se repondrá.')) return
        setError('')
        try {
            const res = await fetch(`/api/rutas?id=${rutaId}`, { method: 'DELETE' })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Ruta eliminada, pedidos y stock revertidos')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    function getResumenProductos(entregas: Entrega[]) {
        const resumen: Record<string, { nombre: string; cantidad: number }> = {}
        for (const e of entregas) {
            for (const d of e.pedido.detalles) {
                const cod = d.presentacion?.producto?.codigoInterno || '?'
                const nombre = d.presentacion?.producto?.nombre || 'Producto'
                const key = `${cod}_x${d.presentacion?.cantidad || '?'}`
                if (!resumen[key]) resumen[key] = { nombre: `[x${d.presentacion?.cantidad || '?'}] ${nombre}`, cantidad: 0 }
                resumen[key].cantidad += d.cantidad
            }
        }
        return Object.values(resumen)
    }

    // Stock warning calculator
    function getStockFaltantes() {
        const necesarios: Record<string, { total: number; label: string }> = {}
        pedidosSeleccionados.forEach(pid => {
            const p = pedidosDisponibles.find(ped => ped.id === pid)
            p?.detalles.forEach(d => {
                const pres = d.presentacion
                if (pres && pres.producto) {
                    const key = `${pres.productoId}_${pres.id}`
                    const label = `[x${pres.cantidad}] ${pres.producto.codigoInterno}`
                    if (!necesarios[key]) necesarios[key] = { total: 0, label }
                    necesarios[key].total += d.cantidad
                }
            })
        })
        const faltantes: string[] = []
        Object.entries(necesarios).forEach(([key, info]) => {
            const stockDisp = stockActual[key] || 0
            if (stockDisp < info.total) faltantes.push(`${info.label}: faltan ${info.total - stockDisp} un.`)
        })
        return faltantes
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando logística...</p></div>

    const entregasTotales = rutas.reduce((a, r) => a + r.entregas.length, 0)
    const entregasCompletadas = rutas.reduce((a, r) => a + r.entregas.filter(e => e.horaEntrega).length, 0)

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>🚛 Planificación de Rutas</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input type="date" className="form-input" value={filterFecha} onChange={e => setFilterFecha(e.target.value)} style={{ height: '38px' }} />
                    {filterFecha && (
                        <button className="btn btn-ghost" onClick={() => setFilterFecha('')} title="Ver todas" style={{ padding: '0 8px', fontSize: '1.2rem' }}>✕</button>
                    )}
                    <button className="btn btn-ghost" onClick={handleFixCoords} title="Reparar coordenadas de clientes"
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>⚙️ Rep. Coords</button>
                    <button className="btn btn-primary" onClick={() => {
                        setFormRuta(f => ({ ...f, fecha: filterFecha || getLocalDateString() }))
                        setRoutePreview(null)
                        setShowModal(true)
                    }}>+ Armar Rutas</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{rutas.length}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>🛣️ Rutas</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: '#2ECC71' }}>{entregasCompletadas}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>✅ Entregados</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: '#F39C12' }}>{entregasTotales - entregasCompletadas}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>🟡 Pendientes</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)' }}>{pedidosDisponibles.length}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>📦 Sin ruta</div>
                </div>
            </div>

            {/* Rutas list */}
            {rutas.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>🛣️</div>
                    <p>No hay rutas para {filterFecha ? `el ${filterFecha.split('-').reverse().join('/')}` : 'esta fecha'}.</p>
                    <button className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} onClick={() => setShowModal(true)}>+ Crear rutas</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {rutas.map(ruta => {
                        const isExpanded = !!expandedRutas[ruta.id]
                        const completadas = ruta.entregas.filter(e => e.horaEntrega).length
                        const total = ruta.entregas.length
                        const progreso = total > 0 ? (completadas / total) * 100 : 0
                        const resumen = getResumenProductos(ruta.entregas)

                        return (
                            <div key={ruta.id} className="card" style={{ overflow: 'hidden', border: '1px solid var(--color-gray-200)' }}>
                                <div
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: 'var(--space-3) var(--space-4)', cursor: 'pointer',
                                        backgroundColor: isExpanded ? 'var(--color-gray-50)' : 'white' }}
                                    onClick={() => setExpandedRutas(prev => ({ ...prev, [ruta.id]: !prev[ruta.id] }))}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                                        <div style={{ fontSize: '1.4rem' }}>{progreso === 100 ? '✅' : '🚛'}</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>
                                                {ruta.chofer?.nombre || 'Sin chofer'}
                                                {ruta.zona && <span style={{ color: 'var(--color-gray-500)', fontWeight: 400, fontSize: 'var(--text-sm)', marginLeft: '8px' }}>· {ruta.zona}</span>}
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', display: 'flex', gap: 'var(--space-3)' }}>
                                                <span>📅 {new Date(ruta.fecha).toLocaleDateString('es-AR')}</span>
                                                {ruta.turno && <span>🕐 {ruta.turno}</span>}
                                                <span>📦 {total} pedidos</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ width: '120px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: progreso === 100 ? '#2ECC71' : 'var(--color-primary)' }}>{completadas}/{total}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--color-gray-400)' }}>{Math.round(progreso)}%</span>
                                            </div>
                                            <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-gray-200)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '3px', width: `${progreso}%`, backgroundColor: progreso === 100 ? '#2ECC71' : 'var(--color-primary)', transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                        <button className="btn btn-icon btn-xs btn-ghost" style={{ color: '#E74C3C' }}
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRuta(ruta.id) }} title="Eliminar ruta">🗑️</button>
                                        <div style={{ fontSize: '1.2rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--color-gray-100)' }}>
                                        {resumen.length > 0 && (
                                            <div style={{ padding: 'var(--space-3) var(--space-4)', backgroundColor: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-100)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-gray-500)', textTransform: 'uppercase' }}>Carga total:</span>
                                                {resumen.map((r, i) => (
                                                    <span key={i} className="badge badge-neutral" style={{ fontSize: '11px' }}>{r.cantidad} {r.nombre}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                            <table className="table table-sm">
                                                <thead><tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                                    <th style={{ width: '30px' }}>#</th><th>Cliente</th><th>Dirección</th><th>Pedido</th><th>Temp.</th><th>Estado</th>
                                                </tr></thead>
                                                <tbody>
                                                    {ruta.entregas.map((entrega, i) => {
                                                        const entregado = !!entrega.horaEntrega
                                                        return (
                                                            <tr key={entrega.id} style={{ opacity: entregado ? 0.7 : 1 }}>
                                                                <td style={{ fontWeight: 600, color: 'var(--color-gray-400)', fontSize: 'var(--text-xs)' }}>{i + 1}</td>
                                                                <td style={{ fontWeight: 600 }}>{entrega.cliente?.nombreComercial || '—'}</td>
                                                                <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                                    {entrega.cliente?.direccion || 'Sin dirección'}
                                                                    {entrega.cliente?.zona && <span style={{ marginLeft: '4px', opacity: 0.7 }}>({entrega.cliente.zona})</span>}
                                                                </td>
                                                                <td style={{ fontSize: 'var(--text-xs)' }}>
                                                                    {entrega.pedido.totalUnidades} und.
                                                                    <span style={{ color: 'var(--color-gray-400)', marginLeft: '4px' }}>${entrega.pedido.totalImporte?.toLocaleString('es-AR') || '0'}</span>
                                                                </td>
                                                                <td style={{ fontSize: 'var(--text-xs)' }}>
                                                                    {entrega.tempEntrega !== null ? (
                                                                        <span style={{ color: entrega.tempEntrega > 8 ? '#E74C3C' : '#2ECC71', fontWeight: 600 }}>{entrega.tempEntrega}°C</span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td>
                                                                    {entregado ? (
                                                                        <div>
                                                                            <span className="badge badge-success" style={{ fontSize: '10px' }}>
                                                                                {entrega.pedido.estado === 'rechazado' ? '❌ Rechazado' : '✅ Entregado'}
                                                                            </span>
                                                                            <div style={{ fontSize: '9px', color: 'var(--color-gray-400)', marginTop: '2px' }}>
                                                                                {new Date(entrega.horaEntrega!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                        </div>
                                                                    ) : <span className="badge badge-warning" style={{ fontSize: '10px' }}>🟡 Pendiente</span>}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Pedidos sin ruta */}
            {pedidosDisponibles.length > 0 && (
                <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-lg)' }}>📦 Pedidos Sin Ruta ({pedidosDisponibles.length})</h2>
                        <div className="table-container">
                            <table className="table table-sm">
                                <thead><tr><th>Cliente</th><th>Zona</th><th>Coords</th><th>Fecha Entrega</th><th>Unidades</th><th>Importe</th></tr></thead>
                                <tbody>
                                    {pedidosDisponibles.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>{p.cliente.nombreComercial}</td>
                                            <td style={{ fontSize: 'var(--text-xs)' }}>{p.cliente.zona || '—'}</td>
                                            <td>{p.cliente.latitud && p.cliente.longitud ? <span title="Geolocalizado">📍</span> : <span title="Sin coordenadas" style={{ opacity: 0.4 }}>❓</span>}</td>
                                            <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(p.fechaEntrega).toLocaleDateString('es-AR')}</td>
                                            <td>{p.totalUnidades}</td>
                                            <td style={{ fontSize: 'var(--text-xs)' }}>${p.totalImporte?.toLocaleString('es-AR') || '0'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Armar Rutas con Optimización */}
            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); setRoutePreview(null) }}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: routePreview ? 900 : 800 }}>
                        <div className="modal-header">
                            <h2>{routePreview ? '📊 Preview de Rutas Optimizadas' : '🚛 Armar Rutas Optimizadas'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setRoutePreview(null) }}>✕</button>
                        </div>

                        {!routePreview ? (
                            /* Step 1: Select config, choferes, pedidos */
                            <div>
                                <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)' }}>
                                    {/* Config Panel */}
                                    <div>
                                        <div className="form-group">
                                            <label className="form-label">📅 Fecha de Ruta</label>
                                            <input type="date" className="form-input" value={formRuta.fecha} onChange={e => setFormRuta({ ...formRuta, fecha: e.target.value })} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">📦 Origen (Stock)</label>
                                            <select className="form-select" value={formRuta.ubicacionOrigenId} onChange={e => setFormRuta({ ...formRuta, ubicacionOrigenId: e.target.value })} required>
                                                <option value="">Seleccionar origen...</option>
                                                {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.tipo})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Turno</label>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                {['Mañana', 'Siesta', 'Tarde'].map(t => (
                                                    <button key={t} type="button" className="btn btn-sm"
                                                        style={{ flex: 1, backgroundColor: formRuta.turno === t ? 'var(--color-primary)' : 'var(--color-gray-100)',
                                                            color: formRuta.turno === t ? '#fff' : 'var(--color-gray-600)', fontWeight: 600, fontSize: 'var(--text-xs)' }}
                                                        onClick={() => setFormRuta({ ...formRuta, turno: t })}
                                                    >{t === 'Mañana' ? '🌅' : t === 'Siesta' ? '☀️' : '🌇'} {t}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">🔢 Máx. paradas por chofer</label>
                                            <input type="number" className="form-input" min={1} max={50} value={maxParadas}
                                                onChange={e => setMaxParadas(parseInt(e.target.value) || 15)} />
                                        </div>

                                        {/* Choferes selection */}
                                        <div className="form-group">
                                            <label className="form-label">🚗 Choferes ({choferesSeleccionados.length})</label>
                                            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', maxHeight: '160px', overflowY: 'auto' }}>
                                                {choferes.map(c => (
                                                    <div key={c.id} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-gray-100)',
                                                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer',
                                                        backgroundColor: choferesSeleccionados.includes(c.id) ? '#EBF5FF' : 'transparent' }}
                                                        onClick={() => toggleChofer(c.id)}>
                                                        <input type="checkbox" checked={choferesSeleccionados.includes(c.id)} readOnly
                                                            style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
                                                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{c.nombre}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        <div style={{ padding: 'var(--space-3)', backgroundColor: pedidosSeleccionados.length > 0 ? 'var(--color-primary-50)' : 'var(--color-gray-50)',
                                            borderRadius: 'var(--radius-md)', border: pedidosSeleccionados.length > 0 ? '1px solid var(--color-primary-200)' : '1px solid var(--color-gray-200)' }}>
                                            <p style={{ margin: 0, fontWeight: 600, color: pedidosSeleccionados.length > 0 ? 'var(--color-primary)' : 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>
                                                {pedidosSeleccionados.length} pedido{pedidosSeleccionados.length !== 1 ? 's' : ''} · {choferesSeleccionados.length} chofer{choferesSeleccionados.length !== 1 ? 'es' : ''}
                                            </p>
                                        </div>

                                        {/* Stock Warning */}
                                        {(() => {
                                            const faltantes = getStockFaltantes()
                                            if (faltantes.length === 0) return null
                                            return (
                                                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: '#FDEDEC', border: '1px solid #F1948A', borderRadius: 'var(--radius-md)' }}>
                                                    <p style={{ margin: '0 0 5px 0', fontSize: 'var(--text-xs)', fontWeight: 700, color: '#C0392B' }}>⚠️ STOCK INSUFICIENTE EN ORIGEN</p>
                                                    <ul style={{ margin: 0, paddingLeft: '15px', color: '#C0392B', fontSize: 'var(--text-xs)' }}>
                                                        {faltantes.map((f, i) => <li key={i}>{f}</li>)}
                                                    </ul>
                                                </div>
                                            )
                                        })()}
                                    </div>

                                    {/* Pedidos selection */}
                                    <div>
                                        {(() => {
                                            // Filtrar pedidos por turno seleccionado
                                            const pedidosFiltrados = pedidosDisponibles.filter(p => {
                                                if (!formRuta.turno) return true
                                                if (!p.turno) return true // mostrar sin turno siempre
                                                return p.turno === formRuta.turno
                                            })
                                            const sinTurno = pedidosFiltrados.filter(p => !p.turno).length
                                            return (<>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <h3 style={{ fontSize: 'var(--text-md)', margin: 0 }}>Pedidos — {formRuta.turno} ({pedidosFiltrados.length})</h3>
                                            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--text-xs)' }}
                                                onClick={() => setPedidosSeleccionados(prev => prev.length === pedidosFiltrados.length ? [] : pedidosFiltrados.map(p => p.id))}>
                                                {pedidosSeleccionados.length === pedidosFiltrados.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                            </button>
                                        </div>
                                        {sinTurno > 0 && (
                                            <div style={{ fontSize: 'var(--text-xs)', color: '#F39C12', marginBottom: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)', backgroundColor: '#FEF9E7', borderRadius: 'var(--radius-sm)' }}>
                                                ⚠️ {sinTurno} pedido{sinTurno > 1 ? 's' : ''} sin turno asignado (se muestran siempre)
                                            </div>
                                        )}
                                        {pedidosFiltrados.length === 0 ? (
                                            <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>No hay pedidos confirmados sin ruta.</p>
                                        ) : (
                                            <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                                                {pedidosFiltrados.map(p => (
                                                    <div key={p.id}
                                                        style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-gray-100)',
                                                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer',
                                                            backgroundColor: pedidosSeleccionados.includes(p.id) ? 'var(--color-primary-50)' : 'transparent' }}
                                                        onClick={() => togglePedido(p.id)}>
                                                        <input type="checkbox" checked={pedidosSeleccionados.includes(p.id)} readOnly
                                                            style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <strong style={{ fontSize: 'var(--text-sm)' }}>
                                                                    {p.cliente.nombreComercial}
                                                                    {p.cliente.latitud && p.cliente.longitud ? (
                                                                        <span title="Ubicación verificada" style={{ marginLeft: '8px', cursor: 'help' }}>📍</span>
                                                                    ) : (
                                                                        <span title="Sin coordenadas" style={{ marginLeft: '8px', cursor: 'help', opacity: 0.5 }}>❓</span>
                                                                    )}
                                                                </strong>
                                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                                    {p.turno && <span className="badge badge-neutral" style={{ fontSize: '9px', marginRight: '4px' }}>{p.turno === 'Mañana' ? '🌅' : p.turno === 'Siesta' ? '☀️' : '🌇'} {p.turno}</span>}
                                                                    {new Date(p.fechaEntrega).toLocaleDateString('es-AR')}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                                {p.cliente.direccion || 'Sin dirección'} {p.cliente.zona ? `· ${p.cliente.zona}` : ''}
                                                                {' · '} {p.totalUnidades} und. · ${p.totalImporte?.toLocaleString('es-AR') || '0'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>)})()}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={isOptimizing}>Cancelar</button>
                                    <button type="button" className="btn btn-primary"
                                        disabled={pedidosSeleccionados.length === 0 || choferesSeleccionados.length === 0 || isOptimizing}
                                        onClick={handleAutoAssignPreview}>
                                        {isOptimizing ? '📍 Optimizando...' : `🚀 Optimizar y Asignar (${choferesSeleccionados.length} choferes)`}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Step 2: Preview optimized routes */
                            <div>
                                <div className="modal-body">
                                    {previewStats && previewStats.sinCoords > 0 && (
                                        <div style={{ padding: 'var(--space-3)', backgroundColor: '#FEF9E7', border: '1px solid #F9E79F', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                                            ⚠️ {previewStats.sinCoords} pedido{previewStats.sinCoords > 1 ? 's' : ''} sin coordenadas. Se agregaron al final de cada ruta para que los reordenes manualmente.
                                        </div>
                                    )}

                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(routePreview.length, 3)}, 1fr)`, gap: 'var(--space-4)' }}>
                                        {routePreview.map((plan, idx) => {
                                            // Build Google Maps URL for this route
                                            const companyCoords = "-34.8237468,-58.1873516"
                                            const waypoints = plan.pedidos
                                                .filter(p => p.lat && p.lng)
                                                .map(p => `${p.lat},${p.lng}`)
                                            const lastWp = waypoints.length > 0 ? waypoints[waypoints.length - 1] : companyCoords
                                            const midWaypoints = waypoints.slice(0, -1).join('|')
                                            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${companyCoords}&destination=${lastWp}${midWaypoints ? `&waypoints=${midWaypoints}` : ''}&travelmode=driving`

                                            return (
                                            <div key={idx} style={{ border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-primary-50)', borderBottom: '1px solid var(--color-primary-200)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>🚛 {plan.choferNombre}</div>
                                                        <a href={mapsUrl} target="_blank" rel="noreferrer"
                                                            style={{ fontSize: 'var(--text-xs)', backgroundColor: '#4285F4', color: 'white', padding: '4px 10px',
                                                                borderRadius: 'var(--radius-sm)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            🗺️ Ver ruta
                                                        </a>
                                                    </div>
                                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', display: 'flex', gap: 'var(--space-3)', marginTop: '4px' }}>
                                                        <span>📦 {plan.pedidos.length + plan.sinCoordenadas.length} paradas</span>
                                                        {plan.totalDistance && <span>📏 {plan.totalDistance} km</span>}
                                                        {plan.totalDuration && <span>⏱ {plan.totalDuration} min</span>}
                                                    </div>
                                                </div>
                                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                    {plan.pedidos.map((p, i) => (
                                                        <div key={p.pedidoId} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-gray-100)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-primary)', minWidth: '20px' }}>{i + 1}.</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{p.clienteNombre} 📍</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{p.direccion || 'Sin dirección'}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <button type="button" disabled={i === 0}
                                                                    style={{ width: 22, height: 22, border: '1px solid var(--color-gray-300)', borderRadius: 4,
                                                                        background: 'white', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0 }}
                                                                    onClick={() => {
                                                                        const updated = [...routePreview!]
                                                                        const items = [...updated[idx].pedidos]
                                                                        ;[items[i - 1], items[i]] = [items[i], items[i - 1]]
                                                                        updated[idx] = { ...updated[idx], pedidos: items }
                                                                        setRoutePreview(updated)
                                                                    }}>▲</button>
                                                                <button type="button" disabled={i === plan.pedidos.length - 1}
                                                                    style={{ width: 22, height: 22, border: '1px solid var(--color-gray-300)', borderRadius: 4,
                                                                        background: 'white', cursor: i === plan.pedidos.length - 1 ? 'default' : 'pointer',
                                                                        opacity: i === plan.pedidos.length - 1 ? 0.3 : 1,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0 }}
                                                                    onClick={() => {
                                                                        const updated = [...routePreview!]
                                                                        const items = [...updated[idx].pedidos]
                                                                        ;[items[i], items[i + 1]] = [items[i + 1], items[i]]
                                                                        updated[idx] = { ...updated[idx], pedidos: items }
                                                                        setRoutePreview(updated)
                                                                    }}>▼</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {plan.sinCoordenadas.length > 0 && (
                                                        <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: '#FEF9E7', borderBottom: '1px solid #F9E79F', fontSize: 'var(--text-xs)', fontWeight: 700, color: '#B7950B' }}>
                                                            ⚠️ Sin coordenadas — ordenar manualmente:
                                                        </div>
                                                    )}
                                                    {plan.sinCoordenadas.map((p, i) => (
                                                        <div key={p.pedidoId} style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-gray-100)',
                                                            display: 'flex', gap: 'var(--space-2)', alignItems: 'center', backgroundColor: '#FFFDF5' }}>
                                                            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#F39C12', minWidth: '20px' }}>{plan.pedidos.length + i + 1}.</span>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{p.clienteNombre} ❓</div>
                                                                <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{p.direccion}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                <button type="button" disabled={i === 0}
                                                                    style={{ width: 22, height: 22, border: '1px solid var(--color-gray-300)', borderRadius: 4,
                                                                        background: 'white', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0 }}
                                                                    onClick={() => {
                                                                        const updated = [...routePreview!]
                                                                        const items = [...updated[idx].sinCoordenadas]
                                                                        ;[items[i - 1], items[i]] = [items[i], items[i - 1]]
                                                                        updated[idx] = { ...updated[idx], sinCoordenadas: items }
                                                                        setRoutePreview(updated)
                                                                    }}>▲</button>
                                                                <button type="button" disabled={i === plan.sinCoordenadas.length - 1}
                                                                    style={{ width: 22, height: 22, border: '1px solid var(--color-gray-300)', borderRadius: 4,
                                                                        background: 'white', cursor: i === plan.sinCoordenadas.length - 1 ? 'default' : 'pointer',
                                                                        opacity: i === plan.sinCoordenadas.length - 1 ? 0.3 : 1,
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0 }}
                                                                    onClick={() => {
                                                                        const updated = [...routePreview!]
                                                                        const items = [...updated[idx].sinCoordenadas]
                                                                        ;[items[i], items[i + 1]] = [items[i + 1], items[i]]
                                                                        updated[idx] = { ...updated[idx], sinCoordenadas: items }
                                                                        setRoutePreview(updated)
                                                                    }}>▼</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setRoutePreview(null)} disabled={isOptimizing}>← Volver a editar</button>
                                    <button type="button" className="btn btn-primary" onClick={handleAutoAssignConfirm} disabled={isOptimizing}>
                                        {isOptimizing ? '⏳ Creando rutas...' : `✅ Confirmar ${routePreview.length} rutas`}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
