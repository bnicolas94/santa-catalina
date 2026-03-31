'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'

interface MovCaja {
    id: string; tipo: string; concepto: string; monto: number; medioPago: string
    cajaOrigen: string | null; descripcion: string | null; fecha: string
    pedido: { id: string; totalImporte: number; cliente: { nombreComercial: string } } | null
    rendicion: { id: string; chofer: { id: string, nombre: string } } | null
    movimientoMp?: { mpId: string; comisionMp: number; montoNeto: number; estado: string; metodoPago: string | null } | null
}

interface Rendicion {
    choferId: string; choferNombre: string; montoEsperado: number
    pedidosEfectivo: number; rendicionId: string | null; estado: string
}

interface Resumen {
    ingresosEfectivo: number; ingresosTransferencia: number; egresosTotal: number; saldo: number
}

interface Concepto {
    id: string; clave: string; nombre: string; activo: boolean
}

function formatCurrency(n: number, visible = true) {
    if (!visible) return '$ ••••••'
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const cajaFetcher = async ([_, fecha]: [string, string]) => {
    const [cajaRes, rendRes, saldosRes, conceptosRes, empRes] = await Promise.all([
        fetch(`/api/caja?fecha=${fecha}`),
        fetch('/api/caja/rendiciones'),
        fetch('/api/caja/saldos'),
        fetch('/api/caja/conceptos'),
        fetch('/api/empleados')
    ])
    
    return {
        cajaData: await cajaRes.json(),
        rendicionesData: await rendRes.json(),
        saldosData: await saldosRes.json(),
        conceptosData: await conceptosRes.json(),
        empleadosData: await empRes.json()
    }
}

export default function CajaPage() {
    const { data: session } = useSession()
    const userRol = (session?.user as any)?.rol
    const ubicacionTipo = (session?.user as any)?.ubicacionTipo

    const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])

    const { data: swrData, isLoading: loading, mutate } = useSWR(['caja-data', fechaFiltro], cajaFetcher, {
        refreshInterval: 15000,
        revalidateOnFocus: true
    })
    const fetchData = () => mutate()

    const movimientos = swrData?.cajaData?.movimientos || []
    const resumen = swrData?.cajaData?.resumen || { ingresosEfectivo: 0, ingresosTransferencia: 0, egresosTotal: 0, saldo: 0 }
    
    const rendDataRaw = swrData?.rendicionesData
    const rendiciones = Array.isArray(rendDataRaw) ? rendDataRaw.filter((r: Rendicion) => r.estado === 'pendiente' && r.montoEsperado > 0) : []

    const saldosData = swrData?.saldosData || {}
    const saldoMadre = saldosData.cajaMadre?.saldo ?? 0
    const saldoChica = saldosData.cajaChica?.saldo ?? 0
    const saldoLocal = saldosData.local?.saldo ?? 0
    const saldoMercadoPago = saldosData.mercadoPago?.saldo ?? 0

    const conceptosData = swrData?.conceptosData
    const conceptos = Array.isArray(conceptosData) ? conceptosData : []

    const empData = swrData?.empleadosData
    const choferes = Array.isArray(empData) ? empData : []
    const [showMPModal, setShowMPModal] = useState(false)
    const [liveMPData, setLiveMPData] = useState<any[]>([])
    const [loadingMP, setLoadingMP] = useState(false)
    const [editingSaldo, setEditingSaldo] = useState<string | null>(null)
    const [editSaldoValue, setEditSaldoValue] = useState('')
    const [editMotivo, setEditMotivo] = useState('ajuste')
    const [editDescripcion, setEditDescripcion] = useState('')
    const [toastNotif, setToastNotif] = useState<{ message: string, amount: number, id: string } | null>(null)
    const movimientosRef = useRef<MovCaja[]>([])

    const checkLiveMP = async () => {
        setLoadingMP(true)
        setShowMPModal(true)
        try {
            const res = await fetch('/api/mercadopago/movimientos?live_mp=true')
            const data = await res.json()
            setLiveMPData(data)
        } catch (error) {
            console.error("Error fetching live MP data", error)
        }
        setLoadingMP(false)
    }

    const [showMontos, setShowMontos] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transfForm, setTransfForm] = useState({ origen: 'local', destino: 'caja_chica', monto: '', fecha: new Date().toISOString().split('T')[0] })
    const [showRendicionModal, setShowRendicionModal] = useState<Rendicion | null>(null)
    const [form, setForm] = useState({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: 'caja_madre', choferId: '', fecha: new Date().toISOString().split('T')[0] })
    const [rendForm, setRendForm] = useState({ montoEntregado: '', observaciones: '' })

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showConceptosModal, setShowConceptosModal] = useState(false)
    const [nuevoConcepto, setNuevoConcepto] = useState('')
    const [editingMov, setEditingMov] = useState<MovCaja | null>(null)

    const allowedBoxes = userRol === 'ADMIN' 
        ? ['caja_madre', 'caja_chica', 'local', 'mercado_pago'] 
        : (ubicacionTipo === 'LOCAL' ? ['local'] : ['caja_madre', 'caja_chica'])

    useEffect(() => {
        // Reset default form boxes if restricted
        if (ubicacionTipo === 'LOCAL') {
            setForm(f => ({ ...f, cajaOrigen: 'local' }))
            setTransfForm(f => ({ ...f, origen: 'local', destino: 'caja_chica' }))
        } else if (ubicacionTipo === 'FABRICA') {
            setForm(f => ({ ...f, cajaOrigen: 'caja_madre' }))
            setTransfForm(f => ({ ...f, origen: 'caja_madre', destino: 'caja_chica' }))
        }
    }, [ubicacionTipo])


    useEffect(() => { 
        // Solicitar permisos de notificación de escritorio
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, [])

    useEffect(() => {
        if (!swrData?.cajaData?.movimientos) return
        
        if (movimientosRef.current.length > 0) {
            const oldIds = new Set(movimientosRef.current.map((m: MovCaja) => m.id))
            const newIncomes = swrData.cajaData.movimientos.filter((m: MovCaja) => 
                m.cajaOrigen === 'mercado_pago' && m.tipo === 'ingreso' && !oldIds.has(m.id)
            )
            if (newIncomes.length > 0) {
                const latest = newIncomes[0];
                setToastNotif({ message: '¡Cobro M.Pago acreditado!', amount: latest.monto, id: latest.id })
                
                const audio = new Audio('/sounds/notification.mp3');
                audio.play().catch(err => console.log('Autoplay preventer by browser:', err));

                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("Nuevo Pago Mercado Pago", {
                        body: `Acreditado: $${latest.monto.toLocaleString('es-AR')}\n${latest.descripcion || ''}`,
                        icon: '/favicon.ico'
                    });
                }
                setTimeout(() => setToastNotif(null), 8000)
            }
        }
        movimientosRef.current = swrData.cajaData.movimientos
    }, [swrData])

    async function updateSaldo(tipo: string) {
        try {
            const res = await fetch('/api/caja/saldos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tipo, 
                    saldo: editSaldoValue,
                    motivo: editMotivo,
                    descripcion: editDescripcion
                }),
            })
            if (!res.ok) throw new Error()
            setEditingSaldo(null)
            setEditMotivo('ajuste')
            setEditDescripcion('')
            setSuccess('Saldo actualizado')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al actualizar saldo') }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/caja', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Error desconocido en el servidor' }))
                throw new Error(data.error || data.details || 'Error al registrar')
            }
            setSuccess('Movimiento registrado')
            setShowModal(false)
            setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: 'caja_madre', choferId: '', fecha: new Date().toISOString().split('T')[0] })
            fetchData()

            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            console.error('[FRONTEND CAJA] Error en handleSubmit:', err)
            setError(err instanceof Error ? err.message : 'Error al conectar con el servidor')
        }
    }

    async function handleEdit(e: React.FormEvent) {
        e.preventDefault()
        if (!editingMov) return
        setError('')
        try {
            const res = await fetch('/api/caja', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingMov.id, ...form }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Movimiento actualizado')
            setShowModal(false)
            setEditingMov(null)
            setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: 'caja_madre', choferId: '', fecha: new Date().toISOString().split('T')[0] })

            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este movimiento?')) return
        try {
            const res = await fetch(`/api/caja?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setSuccess('Movimiento eliminado')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al eliminar') }
    }

    function startEdit(m: MovCaja) {
        setEditingMov(m)
        setForm({
            tipo: m.tipo,
            concepto: m.concepto,
            monto: String(m.monto),
            medioPago: m.medioPago,
            descripcion: m.descripcion || '',
            cajaOrigen: m.cajaOrigen || 'caja_madre',
            choferId: m.rendicion ? m.rendicion.chofer.id : '',
            fecha: new Date(m.fecha).toISOString().split('T')[0],
        })

        setShowModal(true)
    }

    async function handleRendicion() {
        if (!showRendicionModal) return
        setError('')
        try {
            const res = await fetch('/api/caja/rendiciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    choferId: showRendicionModal.choferId,
                    montoEsperado: showRendicionModal.montoEsperado,
                    montoEntregado: rendForm.montoEntregado,
                    observaciones: rendForm.observaciones,
                }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Rendición controlada — efectivo ingresado a caja')
            setShowRendicionModal(null)
            setRendForm({ montoEntregado: '', observaciones: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando caja...</p></div>

    return (
        <div>
            {toastNotif && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
                    background: 'var(--color-primary)', color: 'white', padding: '16px 24px',
                    borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    animation: 'slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    <div style={{ fontSize: '2rem' }}>💳</div>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{toastNotif.message}</div>
                        <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>Monto: {formatCurrency(toastNotif.amount, true)}</div>
                    </div>
                    <button onClick={() => setToastNotif(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '12px', opacity: 0.8 }}>✕</button>
                    <style>{`
                        @keyframes slideInRight {
                            from { transform: translateX(120%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
            <div className="page-header">
                <h1>💰 Caja</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input type="date" className="form-input" value={fechaFiltro}
                        onChange={(e) => setFechaFiltro(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        style={{ width: 170 }}
                    />
                    <button className="btn btn-ghost btn-icon" onClick={() => setShowMontos(!showMontos)}
                        title={showMontos ? 'Ocultar montos' : 'Mostrar montos'}
                        style={{ fontSize: '1.2rem' }}>
                        {showMontos ? '👁️' : '🙈'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>⇄ Transferir</button>
                    <button className="btn btn-primary" onClick={() => { setEditingMov(null); setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: 'caja_madre', choferId: '', fecha: new Date().toISOString().split('T')[0] }); setShowModal(true) }}>+ Registrar Movimiento</button>

                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* ═══ Saldo Total Global (Solo Administratores) ═══ */}
            {userRol === 'ADMIN' && (
                <div className="card" style={{ 
                    marginBottom: 'var(--space-6)', 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
                }}>
                    <div className="card-body" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-gray-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>
                            💰 Dinero Disponible Global (Todas las Cajas)
                        </div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, color: '#10b981', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                            {formatCurrency(saldoMadre + saldoChica + saldoLocal + saldoMercadoPago, showMontos)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                            Suma de Madre + Chica + Local + Mercado Pago
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Saldos de Caja ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allowedBoxes.length}, 1fr)`, gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {/* Caja Madre */}
                {allowedBoxes.includes('caja_madre') && (
                    <div className="card" style={{ borderTop: '3px solid #8E44AD' }}>
                        <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8E44AD', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏦 Caja Madre</span>
                                {(userRol === 'ADMIN') && (
                                    editingSaldo === 'caja_madre' ? (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => setEditingSaldo(null)}>✕</button>
                                            <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => updateSaldo('caja_madre')}>✓</button>
                                        </div>
                                    ) : (
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--color-gray-400)' }}
                                            onClick={() => { setEditingSaldo('caja_madre'); setEditSaldoValue(String(saldoMadre)) }}>✏️ Editar</button>
                                    )
                                )}
                            </div>
                            {editingSaldo === 'caja_madre' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    <input type="number" step="0.01" className="form-input" value={editSaldoValue}
                                        onChange={(e) => setEditSaldoValue(e.target.value)}
                                        style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }} autoFocus />
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <select className="form-select" style={{ fontSize: '0.75rem', padding: '4px' }} 
                                            value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)}>
                                            <option value="ajuste">⚙️ AJUSTE</option>
                                            <option value="arqueo">📋 ARQUEO</option>
                                        </select>
                                    </div>
                                    <input type="text" className="form-input" placeholder="Detalle (opcional)" 
                                        style={{ fontSize: '0.75rem', padding: '4px' }}
                                        value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
                                </div>
                            ) : (
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8E44AD', textAlign: 'center' }}>{formatCurrency(saldoMadre, showMontos)}</div>
                            )}
                        </div>
                    </div>
                )}
                {/* Caja Chica */}
                {allowedBoxes.includes('caja_chica') && (
                    <div className="card" style={{ borderTop: '3px solid #E67E22' }}>
                        <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#E67E22', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💼 Caja Chica</span>
                                {(userRol === 'ADMIN') && (
                                    editingSaldo === 'caja_chica' ? (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => setEditingSaldo(null)}>✕</button>
                                            <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => updateSaldo('caja_chica')}>✓</button>
                                        </div>
                                    ) : (
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--color-gray-400)' }}
                                            onClick={() => { setEditingSaldo('caja_chica'); setEditSaldoValue(String(saldoChica)) }}>✏️ Editar</button>
                                    )
                                )}
                            </div>
                            {editingSaldo === 'caja_chica' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    <input type="number" step="0.01" className="form-input" value={editSaldoValue}
                                        onChange={(e) => setEditSaldoValue(e.target.value)}
                                        style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }} autoFocus />
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <select className="form-select" style={{ fontSize: '0.75rem', padding: '4px' }} 
                                            value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)}>
                                            <option value="ajuste">⚙️ AJUSTE</option>
                                            <option value="arqueo">📋 ARQUEO</option>
                                        </select>
                                    </div>
                                    <input type="text" className="form-input" placeholder="Detalle (opcional)" 
                                        style={{ fontSize: '0.75rem', padding: '4px' }}
                                        value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
                                </div>
                            ) : (
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E67E22', textAlign: 'center' }}>{formatCurrency(saldoChica, showMontos)}</div>
                            )}
                        </div>
                    </div>
                )}
                {/* Local */}
                {allowedBoxes.includes('local') && (
                    <div className="card" style={{ borderTop: '3px solid #27AE60' }}>
                        <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#27AE60', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏪 Local</span>
                                {(userRol === 'ADMIN' || ubicacionTipo === 'LOCAL') && (
                                    editingSaldo === 'local' ? (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => setEditingSaldo(null)}>✕</button>
                                            <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => updateSaldo('local')}>✓</button>
                                        </div>
                                    ) : (
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--color-gray-400)' }}
                                            onClick={() => { setEditingSaldo('local'); setEditSaldoValue(String(saldoLocal)) }}>✏️ Editar</button>
                                    )
                                )}
                            </div>
                            {editingSaldo === 'local' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    <input type="number" step="0.01" className="form-input" value={editSaldoValue}
                                        onChange={(e) => setEditSaldoValue(e.target.value)}
                                        style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }} autoFocus />
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <select className="form-select" style={{ fontSize: '0.75rem', padding: '4px' }} 
                                            value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)}>
                                            <option value="ajuste">⚙️ AJUSTE</option>
                                            <option value="arqueo">📋 ARQUEO</option>
                                        </select>
                                    </div>
                                    <input type="text" className="form-input" placeholder="Detalle (opcional)" 
                                        style={{ fontSize: '0.75rem', padding: '4px' }}
                                        value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
                                </div>
                            ) : (
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#27AE60', textAlign: 'center' }}>{formatCurrency(saldoLocal, showMontos)}</div>
                            )}
                        </div>
                    </div>
                )}
                {/* Mercado Pago */}
                {allowedBoxes.includes('mercado_pago') && (
                    <div className="card" style={{ borderTop: '3px solid #2980B9' }}>
                        <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2980B9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💳 M.Pago</span>
                                {(userRol === 'ADMIN') && (
                                    editingSaldo === 'mercado_pago' ? (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => setEditingSaldo(null)}>✕</button>
                                            <button className="btn btn-primary btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => updateSaldo('mercado_pago')}>✓</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: '#2980B9' }} onClick={checkLiveMP}>🔄 En Vivo</button>
                                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--color-gray-400)' }}
                                                onClick={() => { setEditingSaldo('mercado_pago'); setEditSaldoValue(String(saldoMercadoPago)) }}>✏️ Editar</button>
                                        </div>
                                    )
                                )}
                            </div>
                            {editingSaldo === 'mercado_pago' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    <input type="number" step="0.01" className="form-input" value={editSaldoValue}
                                        onChange={(e) => setEditSaldoValue(e.target.value)}
                                        style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }} autoFocus />
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <select className="form-select" style={{ fontSize: '0.75rem', padding: '4px' }} 
                                            value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)}>
                                            <option value="ajuste">⚙️ AJUSTE</option>
                                            <option value="arqueo">📋 ARQUEO</option>
                                        </select>
                                    </div>
                                    <input type="text" className="form-input" placeholder="Detalle (opcional)" 
                                        style={{ fontSize: '0.75rem', padding: '4px' }}
                                        value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
                                </div>
                            ) : (
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2980B9', textAlign: 'center' }}>{formatCurrency(saldoMercadoPago, showMontos)}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Rendiciones Pendientes ═══ */}
            {rendiciones.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem' }}>🚛 Rendiciones Pendientes de Choferes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {rendiciones.map((r) => (
                            <div key={r.choferId} className="card" style={{ borderLeft: '4px solid #F39C12' }}>
                                <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>🧑‍✈️ {r.choferNombre}</span>
                                        <span className="badge" style={{ backgroundColor: '#F39C1215', color: '#E67E22', border: '1px solid #F39C12' }}>
                                            Pendiente
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: 'var(--space-2)' }}>
                                        {r.pedidosEfectivo} pedidos en efectivo
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E67E22', marginBottom: 'var(--space-3)' }}>
                                        {formatCurrency(r.montoEsperado)}
                                    </div>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                                        setShowRendicionModal(r)
                                        setRendForm({ montoEntregado: String(r.montoEsperado), observaciones: '' })
                                    }}>
                                        ✅ Controlado
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Resumen del Día ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card">
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💵 Efectivo</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#27AE60' }}>{formatCurrency(resumen.ingresosEfectivo, showMontos)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏦 Transferencia</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2980B9' }}>{formatCurrency(resumen.ingresosTransferencia, showMontos)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📤 Egresos</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E74C3C' }}>{formatCurrency(resumen.egresosTotal, showMontos)}</div>
                    </div>
                </div>
                <div className="card" style={{ borderBottom: `3px solid ${resumen.saldo >= 0 ? '#27AE60' : '#E74C3C'}` }}>
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💰 Saldo</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: resumen.saldo >= 0 ? '#27AE60' : '#E74C3C' }}>{formatCurrency(resumen.saldo, showMontos)}</div>
                    </div>
                </div>
            </div>

            {/* ═══ Tabla de Movimientos ═══ */}
            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Concepto</th>
                            <th>Monto</th>
                            <th>Caja</th>
                            <th>Medio</th>
                            <th>Descripción</th>
                            <th>Hora</th>
                            <th style={{ width: 80 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movimientos.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>Sin movimientos para esta fecha</td></tr>
                        ) : movimientos.map((m: MovCaja) => (
                            <tr key={m.id}>
                                <td>
                                    <span className="badge" style={{
                                        backgroundColor: m.tipo === 'ingreso' ? '#2ECC7115' : '#E74C3C15',
                                        color: m.tipo === 'ingreso' ? '#27AE60' : '#E74C3C',
                                        border: `1px solid ${m.tipo === 'ingreso' ? '#2ECC7140' : '#E74C3C40'}`,
                                    }}>
                                        {m.tipo === 'ingreso' ? '⬆️' : '⬇️'} {m.tipo}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                    {conceptos.find(c => c.clave === m.concepto)?.nombre || m.concepto}
                                    {m.rendicion && (
                                        <div style={{ fontSize: '0.7rem', color: '#E67E22', fontWeight: 600 }}>
                                            🧑‍✈️ {m.rendicion.chofer.nombre}
                                        </div>
                                    )}
                                </td>

                                <td style={{ fontWeight: 700, color: m.tipo === 'ingreso' ? '#27AE60' : '#E74C3C' }}>
                                    {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto, showMontos)}
                                </td>
                                <td>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                        {m.cajaOrigen === 'caja_madre' ? '🏦 Madre' : m.cajaOrigen === 'caja_chica' ? '💼 Chica' : m.cajaOrigen === 'local' ? '🏪 Local' : '—'}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ fontSize: '0.8rem' }}>
                                        {m.medioPago === 'transferencia' ? '🏦' : '💵'} {m.medioPago}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.descripcion || (m.pedido ? `Pedido de ${m.pedido.cliente.nombreComercial}` : m.rendicion ? `Rendición de ${m.rendicion.chofer.nombre}` : '—')}
                                    {m.movimientoMp && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)', marginTop: 2 }}>
                                            ID: {m.movimientoMp.mpId} | Com: ${m.movimientoMp.comisionMp}
                                        </div>
                                    )}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                                    {new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        <button className="btn btn-ghost btn-sm" title="Editar" style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                                            onClick={() => startEdit(m)}>✏️</button>
                                        <button className="btn btn-ghost btn-sm" title="Eliminar" style={{ fontSize: '0.8rem', padding: '2px 6px', color: 'var(--color-danger)' }}
                                            onClick={() => handleDelete(m.id)}>🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ═══ Modal Nuevo Movimiento ═══ */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>{editingMov ? '✏️ Editar Movimiento' : 'Registrar Movimiento de Caja'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={editingMov ? handleEdit : handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Fecha de Registro</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={form.fecha}
                                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setForm({ ...form, tipo: 'ingreso' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'ingreso' ? '#27AE60' : '#27AE6018', color: form.tipo === 'ingreso' ? '#fff' : '#27AE60', border: '2px solid #27AE60', fontWeight: 600 }}>
                                            ⬆️ Ingreso
                                        </button>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setForm({ ...form, tipo: 'egreso' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'egreso' ? '#E74C3C' : '#E74C3C18', color: form.tipo === 'egreso' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600 }}>
                                            ⬇️ Egreso
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Caja</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        {[
                                            { key: 'caja_madre', label: '🏦 Madre', color: '#8E44AD' }, 
                                            { key: 'caja_chica', label: '💼 Chica', color: '#E67E22' }, 
                                            { key: 'local', label: '🏪 Local', color: '#27AE60' },
                                            { key: 'mercado_pago', label: '💳 M.Pago', color: '#2980B9' }
                                        ].filter(c => allowedBoxes.includes(c.key)).map((c) => (
                                            <button key={c.key} type="button" className="btn btn-sm"
                                                onClick={() => setForm({ ...form, cajaOrigen: c.key })}
                                                style={{ flex: 1, backgroundColor: form.cajaOrigen === c.key ? c.color : `${c.color}18`, color: form.cajaOrigen === c.key ? '#fff' : c.color, border: `2px solid ${c.color}`, fontWeight: 600, fontSize: '0.8rem' }}>
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Concepto</label>
                                        <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', padding: '2px 8px', color: 'var(--color-gray-400)' }}
                                            onClick={() => setShowConceptosModal(true)}>⚙️ Gestionar</button>
                                    </div>
                                    <select className="form-select" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} required>
                                        <option value="">Seleccionar concepto...</option>
                                        {conceptos.filter(c => c.activo).map(c => (
                                            <option key={c.id} value={c.clave}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                {form.concepto === 'rendicion_chofer' && (
                                    <div className="form-group">
                                        <label className="form-label">Chofer que rinde</label>
                                        <select
                                            className="form-select"
                                            value={form.choferId}
                                            onChange={(e) => setForm({ ...form, choferId: e.target.value })}
                                            required
                                            style={{ border: '2px solid #F39C12' }}
                                        >
                                            <option value="">Seleccionar chofer...</option>
                                            {choferes.filter(e => e.activo && e.rol === 'LOGISTICA').map(c => (
                                                <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Monto ($)</label>
                                    <input type="number" step="0.01" min="0" className="form-input" value={form.monto}
                                        onChange={(e) => setForm({ ...form, monto: e.target.value })} required placeholder="0.00" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Medio de Pago</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setForm({ ...form, medioPago: 'efectivo' })}
                                            style={{ flex: 1, backgroundColor: form.medioPago === 'efectivo' ? '#27AE60' : '#27AE6018', color: form.medioPago === 'efectivo' ? '#fff' : '#27AE60', border: '2px solid #27AE60', fontWeight: 600 }}>
                                            💵 Efectivo
                                        </button>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setForm({ ...form, medioPago: 'transferencia' })}
                                            style={{ flex: 1, backgroundColor: form.medioPago === 'transferencia' ? '#2980B9' : '#2980B918', color: form.medioPago === 'transferencia' ? '#fff' : '#2980B9', border: '2px solid #2980B9', fontWeight: 600 }}>
                                            🏦 Transferencia
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descripción (opcional)</label>
                                    <input type="text" className="form-input" value={form.descripcion}
                                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Almuerzo del equipo" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setEditingMov(null) }}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingMov ? 'Guardar' : 'Registrar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Modal Rendición Chofer ═══ */}
            {showRendicionModal && (
                <div className="modal-overlay" onClick={() => setShowRendicionModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>✅ Controlar Rendición</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowRendicionModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Chofer</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>🧑‍✈️ {showRendicionModal.choferNombre}</div>
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: '#F39C1210', borderRadius: 'var(--radius-md)', border: '1px solid #F39C1240' }}>
                                <div style={{ fontSize: '0.75rem', color: '#E67E22', fontWeight: 600, textTransform: 'uppercase' }}>Monto Esperado</div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E67E22' }}>{formatCurrency(showRendicionModal.montoEsperado)}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>{showRendicionModal.pedidosEfectivo} pedidos en efectivo</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monto Entregado ($)</label>
                                <input type="number" step="0.01" className="form-input" value={rendForm.montoEntregado}
                                    onChange={(e) => setRendForm({ ...rendForm, montoEntregado: e.target.value })}
                                    style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }} required />
                            </div>
                            {rendForm.montoEntregado && parseFloat(rendForm.montoEntregado) !== showRendicionModal.montoEsperado && (
                                <div style={{
                                    padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem',
                                    backgroundColor: parseFloat(rendForm.montoEntregado) < showRendicionModal.montoEsperado ? '#E74C3C15' : '#2ECC7115',
                                    color: parseFloat(rendForm.montoEntregado) < showRendicionModal.montoEsperado ? '#E74C3C' : '#27AE60',
                                    border: `1px solid ${parseFloat(rendForm.montoEntregado) < showRendicionModal.montoEsperado ? '#E74C3C40' : '#2ECC7140'}`,
                                    marginBottom: 'var(--space-3)',
                                }}>
                                    {parseFloat(rendForm.montoEntregado) < showRendicionModal.montoEsperado
                                        ? `⚠️ Faltante: ${formatCurrency(showRendicionModal.montoEsperado - parseFloat(rendForm.montoEntregado))}`
                                        : `✅ Sobrante: ${formatCurrency(parseFloat(rendForm.montoEntregado) - showRendicionModal.montoEsperado)}`
                                    }
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Observaciones (si hay diferencia)</label>
                                <input type="text" className="form-input" value={rendForm.observaciones}
                                    onChange={(e) => setRendForm({ ...rendForm, observaciones: e.target.value })}
                                    placeholder="Ej: Faltaron $200, vuelto erróneo" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={() => setShowRendicionModal(null)}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={handleRendicion}>✅ Confirmar Rendición</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Modal Gestionar Conceptos ═══ */}
            {showConceptosModal && (
                <div className="modal-overlay" onClick={() => setShowConceptosModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>⚙️ Gestionar Conceptos</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowConceptosModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                <input type="text" className="form-input" placeholder="Ej: 💳 Pago Tarjeta" value={nuevoConcepto}
                                    onChange={(e) => setNuevoConcepto(e.target.value)}
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && nuevoConcepto.trim()) {
                                            e.preventDefault()
                                            await fetch('/api/caja/conceptos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevoConcepto.trim() }) })
                                            setNuevoConcepto('')
                                            fetchData()
                                        }
                                    }} />
                                <button className="btn btn-primary" onClick={async () => {
                                    if (!nuevoConcepto.trim()) return
                                    await fetch('/api/caja/conceptos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevoConcepto.trim() }) })
                                    setNuevoConcepto('')
                                    fetchData()
                                }}>+</button>
                            </div>
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {conceptos.map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                                        <span style={{ fontWeight: 600, opacity: c.activo ? 1 : 0.4, fontSize: '0.9rem' }}>{c.nombre}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-sm" title={c.activo ? 'Desactivar' : 'Activar'}
                                                style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                                                onClick={async () => {
                                                    await fetch('/api/caja/conceptos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, activo: !c.activo }) })
                                                    fetchData()
                                                }}>{c.activo ? '👁️' : '🙈'}</button>
                                            <button className="btn btn-ghost btn-sm" title="Eliminar"
                                                style={{ fontSize: '0.8rem', padding: '2px 6px', color: 'var(--color-danger)' }}
                                                onClick={async () => {
                                                    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return
                                                    await fetch(`/api/caja/conceptos?id=${c.id}`, { method: 'DELETE' })
                                                    fetchData()
                                                }}>🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowConceptosModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ Modal Transferencia ═══ */}
            {showTransferModal && (
                <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>⇄ Transferir entre Cajas</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowTransferModal(false)}>✕</button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault()
                            setError('')
                            try {
                                const res = await fetch('/api/caja/transferir', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(transfForm),
                                })
                                if (!res.ok) { 
                                    const data = await res.json()
                                    throw new Error(data.details || data.error || 'Error al procesar la transferencia') 
                                }
                                setSuccess('Transferencia realizada correctamente')
                                setShowTransferModal(false)
                                setTransfForm({ origen: 'local', destino: 'caja_chica', monto: '', fecha: new Date().toISOString().split('T')[0] })
                                fetchData()
                                setTimeout(() => setSuccess(''), 3000)
                            } catch (err: unknown) { 
                                console.error('[TRANSFER] Error:', err)
                                if (err instanceof Error) {
                                    setError(err.message)
                                } else {
                                    setError('Error desconocido al procesar la transferencia')
                                }
                            }
                        }}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input type="date" className="form-input" value={transfForm.fecha}
                                        onChange={(e) => setTransfForm({ ...transfForm, fecha: e.target.value })} required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Desde</label>
                                        <select className="form-select" value={transfForm.origen} onChange={(e) => setTransfForm({ ...transfForm, origen: e.target.value })}>
                                            {allowedBoxes.includes('caja_madre') && <option value="caja_madre">🏦 Madre</option>}
                                            {allowedBoxes.includes('caja_chica') && <option value="caja_chica">💼 Chica</option>}
                                            {allowedBoxes.includes('local') && <option value="local">🏪 Local</option>}
                                            {allowedBoxes.includes('mercado_pago') && <option value="mercado_pago">💳 Mercado Pago</option>}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Hacia</label>
                                        <select className="form-select" value={transfForm.destino} onChange={(e) => setTransfForm({ ...transfForm, destino: e.target.value })}>
                                            {allowedBoxes.includes('caja_madre') && <option value="caja_madre">🏦 Madre</option>}
                                            {allowedBoxes.includes('caja_chica') && <option value="caja_chica">💼 Chica</option>}
                                            {allowedBoxes.includes('local') && <option value="local">🏪 Local</option>}
                                            {allowedBoxes.includes('mercado_pago') && <option value="mercado_pago">💳 Mercado Pago</option>}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Monto ($)</label>
                                    <input type="number" step="0.01" min="0.01" className="form-input" placeholder="0.00" value={transfForm.monto}
                                        onChange={(e) => setTransfForm({ ...transfForm, monto: e.target.value })} required 
                                        style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowTransferModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Realizar Transferencia</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal MP en Vivo */}
            {showMPModal && (
                <div className="modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999 }} onClick={(e) => { if (e.target === e.currentTarget) setShowMPModal(false) }}>
                    <div className="modal-content" style={{ maxWidth: '900px', width: '95%', backgroundColor: '#ffffff', padding: '2rem', borderRadius: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ color: 'var(--color-text)' }}>Conexión en Vivo: Últimos 15 Pagos MP</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', marginBottom: '1.5rem' }}>
                            Estos datos vienen <strong>directamente de la API de Mercado Pago</strong>, sin pasar por la base de datos local. Sirve para corroborar que tu cuenta está recibiendo fondos de manera efectiva.
                        </p>
                        {loadingMP ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>Conectando a servidores de Mercado Pago...</div>
                        ) : (
                            <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>ID MP</th>
                                            <th>Pagador / Descripción</th>
                                            <th>Fecha Aprobación</th>
                                            <th>Estado</th>
                                            <th>Monto Bruto</th>
                                            <th>Bruto Neto</th>
                                            <th>Método</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {liveMPData.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center' }}>No se obtuvieron registros de la API.</td></tr>
                                        ) : (liveMPData.map(p => {
                                            const isEgreso = !p.collector_id || String(p.collector_id) !== '231378824';
                                            const color = isEgreso ? '#dc2626' : '#16a34a';
                                            const prefix = isEgreso ? '-' : '+';
                                            const payerName = (p.payer?.first_name || p.payer?.last_name) 
                                                ? `${p.payer.first_name ?? ''} ${p.payer.last_name ?? ''}`.trim()
                                                : (p.payer?.email ? p.payer.email.split('@')[0] : 'Cliente MP');

                                            return (
                                                <tr key={p.id}>
                                                    <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.id}</td>
                                                    <td>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                            {payerName}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                                                            {p.description || '-'}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem' }}>{p.date_approved ? new Date(p.date_approved).toLocaleString('es-AR') : p.date_created}</td>
                                                    <td>
                                                        <span className={`badge ${p.status === 'approved' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 'bold', color }}>{prefix} ${p.transaction_amount}</td>
                                                    <td style={{ color }}>{prefix} ${p.transaction_details?.net_received_amount ?? p.transaction_amount}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-gray-600)' }}>{p.payment_method_id || '-'}</td>
                                                </tr>
                                            );
                                        }))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShowMPModal(false)}>Cerrar</button>
                            <button type="button" className="btn btn-primary" onClick={checkLiveMP} disabled={loadingMP}>Actualizar Lista MP</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
