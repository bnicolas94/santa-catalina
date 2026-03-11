'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface Cliente { id: string; nombreComercial: string; direccion: string; zona: string }
interface Pedido { id: string; totalUnidades: number; estado: string; detalles: { cantidad: number; presentacion: { cantidad: number; producto: { codigoInterno: string } } }[] }
interface Entrega {
    id: string; horaEntrega: string | null; tempEntrega: number | null
    unidadesRechazadas: number; motivoRechazo: string | null; observaciones: string | null
    cliente: Cliente; pedido: Pedido
}
interface Ruta { id: string; fecha: string; zona: string; entregas: Entrega[] }

export default function RepartosPage() {
    const { data: session } = useSession()
    const userId = (session?.user as { id?: string })?.id

    const [rutas, setRutas] = useState<Ruta[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null)
    const [formEntrega, setFormEntrega] = useState({ tempEntrega: '', unidadesRechazadas: '0', motivoRechazo: '', observaciones: '' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const fetchData = useCallback(async () => {
        if (!userId) return
        try {
            const today = new Date().toISOString().split('T')[0]
            const res = await fetch(`/api/rutas?choferId=${userId}&fecha=${today}`)
            const data = await res.json()
            setRutas(Array.isArray(data) ? data : [])
        } catch { setError('Error al cargar la ruta') } finally { setLoading(false) }
    }, [userId])

    useEffect(() => { fetchData() }, [fetchData])

    async function handleConfirmarEntrega(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!selectedEntrega) return

        try {
            const res = await fetch(`/api/entregas/${selectedEntrega.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formEntrega),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Entrega registrada correctamente')
            setSelectedEntrega(null)
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    if (!session) return null
    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando ruta de hoy...</p></div>

    // Obtenemos solo la primera ruta de hoy (generalmente 1 por chofer por día)
    const rutaDeHoy = rutas.length > 0 ? rutas[0] : null

    // Sort entregas: Pendientes first, Entregadas last
    const entregasSorted = rutaDeHoy ? [...rutaDeHoy.entregas].sort((a, b) => {
        if (a.horaEntrega && !b.horaEntrega) return 1
        if (!a.horaEntrega && b.horaEntrega) return -1
        return 0
    }) : []

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
                <h1>📍 Mis Repartos</h1>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {!rutaDeHoy ? (
                <div className="empty-state" style={{ padding: 'var(--space-6) 0' }}>
                    <p style={{ fontSize: '48px', margin: 0 }}>🏍️</p>
                    <p>No tenés rutas asignadas para hoy.</p>
                </div>
            ) : (() => {
                const completadas = entregasSorted.filter(e => !!e.horaEntrega).length
                return (
                    <>
                        <div style={{ backgroundColor: 'var(--color-primary-50)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', border: '1px solid var(--color-primary-200)' }}>
                            <h2 style={{ fontSize: 'var(--text-lg)', margin: '0 0 var(--space-1) 0', color: 'var(--color-primary)' }}>Ruta en progreso</h2>
                            <span style={{ fontSize: 'var(--text-sm)' }}>
                                {completadas} de {entregasSorted.length} entregas completadas
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', margin: '0 0 var(--space-2)' }}>
                                        Ruta {new Date(rutaDeHoy.fecha).toLocaleDateString('es-AR')}
                                    </h2>
                                    <div style={{ color: 'var(--color-gray-500)' }}>
                                        📍 Zona: {rutaDeHoy.zona || 'Sin zona especificada'}
                                        {' · '} 📦 {rutaDeHoy.entregas.length} pedidos
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                        {completadas} / {rutaDeHoy.entregas.length}
                                    </div>
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>entregados</div>
                                </div>
                            </div>

                            {/* Botón iniciar recorrido (Google Maps multi-stop) */}
                            {rutaDeHoy.entregas.length > 0 && completadas < rutaDeHoy.entregas.length && (
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&origin=Mi+Ubicacion&destination=${encodeURIComponent(entregasSorted[entregasSorted.length - 1].cliente.direccion || '')}&waypoints=${entregasSorted.slice(0, -1).filter(e => !e.horaEntrega && e.cliente.direccion).map(e => encodeURIComponent(e.cliente.direccion || '')).join('|')}&travelmode=driving`}
                                    target="_blank" rel="noreferrer"
                                    className="btn"
                                    style={{ width: '100%', marginBottom: 'var(--space-4)', backgroundColor: '#4285F4', color: 'white', fontWeight: 600, fontSize: '1.1rem', height: '48px' }}
                                >
                                    🗺️ Iniciar Recorrido Completo
                                </a>
                            )}

                            {entregasSorted.map((entrega, i) => {
                                const estaEntregado = !!entrega.horaEntrega
                                return (
                                    <div key={entrega.id} className="card" style={{ padding: 'var(--space-4)', opacity: estaEntregado ? 0.7 : 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                                            <div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 600, marginBottom: '2px' }}>
                                                    VISITA #{i + 1}
                                                </div>
                                                <h3 style={{
                                                    fontSize: 'var(--text-lg)', margin: 0,
                                                    textDecoration: estaEntregado && entrega.pedido.estado === 'rechazado' ? 'line-through' : 'none',
                                                    color: estaEntregado ? 'var(--color-gray-600)' : 'inherit'
                                                }}>
                                                    {entrega.cliente.nombreComercial}
                                                </h3>
                                            </div>
                                            {estaEntregado ? (
                                                <span className="badge badge-success" style={{ fontWeight: 600 }}>{entrega.pedido.estado === 'rechazado' ? 'Rechazado' : 'Entregado'}</span>
                                            ) : (
                                                <span className="badge badge-warning">En camino</span>
                                            )}
                                        </div>
                                        <p style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-md)', color: 'var(--color-gray-600)' }}>
                                            📍 {entrega.cliente.direccion || 'Sin dirección registrada'}
                                        </p>

                                        <div style={{ backgroundColor: 'var(--color-gray-50)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }}>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                                                📦 Pedido: {entrega.pedido.totalUnidades} sándwiches
                                            </div>
                                            {entrega.pedido.detalles.map((d, idx) => {
                                                const pres = d.presentacion
                                                return (
                                                    <div key={idx} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>
                                                        - {d.cantidad} un. de x{pres?.cantidad ?? '?'} {pres?.producto?.codigoInterno ?? ''}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {!estaEntregado ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrega.cliente.direccion + ' ' + entrega.cliente.zona)}`}
                                                    target="_blank" rel="noreferrer"
                                                    className="btn btn-outline" style={{ textAlign: 'center', color: 'var(--color-primary)' }}>
                                                    🗺️ Navegar
                                                </a>
                                                <button className="btn btn-primary" onClick={() => {
                                                    setSelectedEntrega(entrega)
                                                    setFormEntrega({ tempEntrega: '', unidadesRechazadas: '0', motivoRechazo: '', observaciones: '' })
                                                }}>
                                                    Entregar
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                ✓ Entregado a las {new Date(entrega.horaEntrega!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                {entrega.tempEntrega && ` · Temp: ${entrega.tempEntrega}°C`}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )
            })()}

            {/* Modal de Control de Entrega (Mobile First) */}
            {selectedEntrega && (
                <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setSelectedEntrega(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{
                        margin: 0, maxWidth: '100%', width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                        animation: 'slideUp 0.3s ease-out forwards'
                    }}>
                        <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: 'var(--text-lg)', margin: 0 }}>Completar Entrega</h2>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{selectedEntrega.cliente.nombreComercial}</span>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setSelectedEntrega(null)}>✕</button>
                        </div>
                        <form onSubmit={handleConfirmarEntrega}>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        Temperatura de entrega (°C)
                                        <span style={{ fontWeight: 400, color: 'var(--color-gray-500)' }}>(Máx. 8°C)</span>
                                    </label>
                                    <input type="number" step="0.1" className="form-input"
                                        style={{ fontSize: '18px', padding: 'var(--space-3)' }}
                                        value={formEntrega.tempEntrega}
                                        onChange={e => setFormEntrega({ ...formEntrega, tempEntrega: e.target.value })}
                                        placeholder="Ej: 4.5" required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unidades rechazadas (opcional)</label>
                                    <input type="number" min="0" className="form-input"
                                        style={{ fontSize: '18px', padding: 'var(--space-3)' }}
                                        value={formEntrega.unidadesRechazadas}
                                        onChange={e => setFormEntrega({ ...formEntrega, unidadesRechazadas: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                {parseInt(formEntrega.unidadesRechazadas) > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Motivo de rechazo</label>
                                        <select className="form-select" style={{ fontSize: '16px', padding: 'var(--space-3)' }} value={formEntrega.motivoRechazo} onChange={e => setFormEntrega({ ...formEntrega, motivoRechazo: e.target.value })} required>
                                            <option value="">Seleccionar motivo...</option>
                                            <option value="temp_alta">Cadena de frío (Temperatura alta)</option>
                                            <option value="calidad">Problema de calidad visual</option>
                                            <option value="fecha_venc">Fecha de vencimiento próxima</option>
                                            <option value="sobrante">Sobrante del pedido anterior</option>
                                            <option value="otro">Otro</option>
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Observaciones (opcional)</label>
                                    <textarea className="form-input" rows={2} value={formEntrega.observaciones} onChange={e => setFormEntrega({ ...formEntrega, observaciones: e.target.value })} placeholder="Local cerrado, no estaba la encargada, etc." />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-gray-200)' }}>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '56px', fontSize: 'var(--text-lg)' }}>
                                    Confirmar {parseInt(formEntrega.unidadesRechazadas) > 0 ? '(con rechazos)' : 'Entrega'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
