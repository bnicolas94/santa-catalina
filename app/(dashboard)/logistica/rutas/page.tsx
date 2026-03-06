'use client'

import { useState, useEffect } from 'react'

interface Cliente { id: string; nombreComercial: string; zona?: string; direccion?: string }
interface Pedido {
    id: string; fechaPedido: string; fechaEntrega: string; estado: string
    totalUnidades: number; totalImporte: number
    cliente: Cliente; detalles: unknown[]
}
interface Empleado { id: string; nombre: string; rol: string }
interface Ruta { id: string; fecha: string; chofer: { nombre: string }; entregas: unknown[] }

export default function PlanificacionRutasPage() {
    const [pedidosDisponibles, setPedidosDisponibles] = useState<Pedido[]>([])
    const [choferes, setChoferes] = useState<Empleado[]>([])
    const [rutas, setRutas] = useState<Ruta[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Formulario de nueva ruta
    const [formRuta, setFormRuta] = useState({ choferId: '', fecha: new Date().toISOString().split('T')[0], zona: '' })
    const [pedidosSeleccionados, setPedidosSeleccionados] = useState<string[]>([])

    useEffect(() => { fetchData() }, [])

    async function fetchData() {
        try {
            const [pedRes, empRes, rutaRes] = await Promise.all([
                fetch('/api/pedidos'),
                fetch('/api/empleados'),
                fetch('/api/rutas') // Added earlier
            ])
            const pedData = await pedRes.json()
            const empData = await empRes.json()
            const rutaData = await rutaRes.json()

            // Solo mostrar pedidos que falten entregar (pendiente o confirmado) y no en ruta
            const disponibles = Array.isArray(pedData)
                ? pedData.filter((p: Pedido) => p.estado === 'pendiente' || p.estado === 'confirmado')
                : []
            setPedidosDisponibles(disponibles)

            const soloChoferes = Array.isArray(empData)
                ? empData.filter((e: Empleado) => e.rol === 'LOGISTICA' || e.rol === 'ADMIN')
                : []
            setChoferes(soloChoferes)

            setRutas(Array.isArray(rutaData) ? rutaData : [])
        } catch { setError('Error al cargar datos') } finally { setLoading(false) }
    }

    const togglePedido = (pedidoId: string) => {
        setPedidosSeleccionados(prev =>
            prev.includes(pedidoId) ? prev.filter(id => id !== pedidoId) : [...prev, pedidoId]
        )
    }

    async function handleSubmitRuta(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!pedidosSeleccionados.length) {
            setError('Debe seleccionar al menos un pedido para la ruta')
            return
        }

        // Map the selected pedido ids to their objects to easily get the clienteId
        const payloadPedidos = pedidosSeleccionados.map(pid => {
            const ped = pedidosDisponibles.find(p => p.id === pid)
            return { pedidoId: pid, clienteId: ped?.cliente.id }
        })

        try {
            const res = await fetch('/api/rutas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formRuta, pedidos: payloadPedidos }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Ruta creada con éxito')
            setShowModal(false)
            setFormRuta({ choferId: '', fecha: new Date().toISOString().split('T')[0], zona: '' })
            setPedidosSeleccionados([])
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }


    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando logística...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>🚛 Planificación de Rutas</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nueva Ruta</button>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                {/* Panel 1: Rutas de hoy/próximas */}
                <div className="card">
                    <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>🛣️ Rutas Activas / Histórico</h2>
                    {rutas.length === 0 ? (
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay rutas registradas.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {rutas.map(r => (
                                <div key={r.id} style={{ padding: 'var(--space-3)', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                        <strong>Chofer: {r.chofer?.nombre || 'Desconocido'}</strong>
                                        <span className="badge badge-neutral">{new Date(r.fecha).toLocaleDateString('es-AR')}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)' }}>
                                        {r.entregas.length} pedidos asignados
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Panel 2: Pedidos Pendientes */}
                <div className="card">
                    <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>📦 Pedidos Sin Ruta</h2>
                    {pedidosDisponibles.length === 0 ? (
                        <p style={{ color: 'var(--color-gray-500)' }}>No hay pedidos pendientes de entrega.</p>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Zona</th>
                                        <th>Fecha Entrega</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosDisponibles.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>{p.cliente.nombreComercial}</td>
                                            <td>{p.cliente.zona || '-'}</td>
                                            <td>{new Date(p.fechaEntrega).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Nueva Ruta */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2>Armar Ruta</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmitRuta}>
                            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-6)' }}>
                                {/* Col config ruta */}
                                <div>
                                    <div className="form-group">
                                        <label className="form-label">Chofer / Repartidor</label>
                                        <select className="form-select" value={formRuta.choferId} onChange={e => setFormRuta({ ...formRuta, choferId: e.target.value })} required>
                                            <option value="">Seleccionar...</option>
                                            {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de Ruta</label>
                                        <input type="date" className="form-input" value={formRuta.fecha} onChange={e => setFormRuta({ ...formRuta, fecha: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Zona (opcional)</label>
                                        <input type="text" className="form-input" value={formRuta.zona} onChange={e => setFormRuta({ ...formRuta, zona: e.target.value })} placeholder="Ej: Zona Norte" />
                                    </div>
                                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                                        <p style={{ margin: 0, fontWeight: 600 }}>{pedidosSeleccionados.length} pedidos seleccionados</p>
                                    </div>
                                </div>

                                {/* Col select pedidos */}
                                <div>
                                    <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>Seleccionar Pedidos</h3>
                                    {pedidosDisponibles.length === 0 ? (
                                        <p style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>No hay pedidos sin ruta.</p>
                                    ) : (
                                        <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)' }}>
                                            {pedidosDisponibles.map(p => (
                                                <div key={p.id}
                                                    style={{
                                                        padding: 'var(--space-3)', borderBottom: '1px solid var(--color-gray-100)',
                                                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer',
                                                        backgroundColor: pedidosSeleccionados.includes(p.id) ? 'var(--color-primary-50)' : 'transparent'
                                                    }}
                                                    onClick={() => togglePedido(p.id)}
                                                >
                                                    <input type="checkbox" checked={pedidosSeleccionados.includes(p.id)} readOnly style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <strong style={{ fontSize: 'var(--text-sm)' }}>{p.cliente.nombreComercial}</strong>
                                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{new Date(p.fechaEntrega).toLocaleDateString('es-AR')}</span>
                                                        </div>
                                                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                            {p.cliente.direccion || 'Sin dirección'} {p.cliente.zona ? `· ${p.cliente.zona}` : ''}
                                                            {' · '} {p.totalUnidades} und.
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={pedidosSeleccionados.length === 0}>Guardar Ruta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
