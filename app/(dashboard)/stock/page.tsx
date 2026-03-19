'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Insumo { id: string; nombre: string; unidadMedida: string; stockActual: number; unidadSecundaria?: string; factorConversion?: number; stockActualSecundario?: number; stocks?: any[] }
interface Proveedor { id: string; nombre: string }
interface Movimiento {
    id: string; tipo: string; cantidad: number; cantidadSecundaria: number | null; fecha: string; observaciones: string | null
    costoTotal: number | null; estadoPago: string | null; fechaVencimiento: string | null;
    insumo: { id: string; nombre: string; unidadMedida: string; unidadSecundaria?: string | null }
    proveedor: { id: string; nombre: string } | null
    ubicacion: { id: string; nombre: string } | null
}

function StockContent() {
    const searchParams = useSearchParams()
    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [ubicaciones, setUbicaciones] = useState<any[]>([])
    const [selectedUbi, setSelectedUbi] = useState<string>('')
    const [stockProductos, setStockProductos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filterTipo, setFilterTipo] = useState('')
    const [filterInsumo, setFilterInsumo] = useState('')
    const [filterFecha, setFilterFecha] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD local
    const [filterPago, setFilterPago] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '',
        costoTotal: '', estadoPago: 'pagado', actualizarCosto: true,
        useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '',
        ubicacionId: '',
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchData() }, [])

    useEffect(() => {
        const pago = searchParams.get('pago')
        if (pago === 'pendiente') {
            setFilterPago('pendiente')
            setFilterFecha('') // Mostrar todos los pendientes sin importar fecha
        }
    }, [searchParams])

    async function fetchData() {
        try {
            const [movRes, insRes, provRes, ubiRes, stockProdRes] = await Promise.all([
                fetch('/api/movimientos-stock'),
                fetch('/api/insumos'),
                fetch('/api/proveedores'),
                fetch('/api/ubicaciones'),
                fetch('/api/stock-producto')
            ])
            const movData = await movRes.json()
            const insData = await insRes.json()
            const provData = await provRes.json()
            const ubiData = await ubiRes.json()
            const stockProdData = await stockProdRes.json()

            setMovimientos(Array.isArray(movData) ? movData : [])
            setInsumos(Array.isArray(insData) ? insData : [])
            setProveedores(Array.isArray(provData) ? provData : [])
            setUbicaciones(Array.isArray(ubiData) ? ubiData : [])
            setStockProductos(Array.isArray(stockProdData) ? stockProdData : [])
        } catch { setError('Error al cargar datos') } finally { setLoading(false) }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const cleansingForm = {
                ...form,
                cantidad: String(form.cantidad).replace(',', '.'),
                cantidadSecundaria: String(form.cantidadSecundaria).replace(',', '.'),
                costoTotal: String(form.costoTotal).replace(',', '.'),
                bultos: String(form.bultos).replace(',', '.'),
                unidadesPorBulto: String(form.unidadesPorBulto).replace(',', '.'),
            }

            const payloadParams = {
                ...cleansingForm,
                cantidad: cleansingForm.useBultos 
                    ? String(parseFloat(cleansingForm.bultos || '0') * parseFloat(cleansingForm.unidadesPorBulto || '1')) 
                    : cleansingForm.cantidad,
            }

            const res = await fetch(editingId ? `/api/movimientos-stock/${editingId}` : '/api/movimientos-stock', {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadParams),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(`Movimiento ${editingId ? 'actualizado' : 'registrado'} correctamente`)
            setShowModal(false)
            setEditingId(null)
            setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', ubicacionId: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    function handleEdit(mov: Movimiento) {
        setEditingId(mov.id)
        setForm({
            insumoId: mov.insumo.id,
            tipo: mov.tipo,
            cantidad: String(mov.cantidad),
            cantidadSecundaria: mov.cantidadSecundaria ? String(mov.cantidadSecundaria) : '',
            observaciones: mov.observaciones || '',
            proveedorId: mov.proveedor?.id || '',
            costoTotal: mov.costoTotal ? String(mov.costoTotal) : '',
            estadoPago: mov.estadoPago || 'pagado',
            actualizarCosto: false, // Por defecto false al editar para no pisar sin querer
            useBultos: false,
            bultos: '',
            unidadesPorBulto: '',
            fechaVencimiento: mov.fechaVencimiento ? new Date(mov.fechaVencimiento).toLocaleDateString('en-CA') : '',
            ubicacionId: mov.ubicacion?.id || '',
        })
        setShowModal(true)
    }

    async function handlePago(id: string) {
        if (!confirm('¿Marcar compra como pagada y generar un Gasto Operativo en el reporte de Rentabilidad?')) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}/pago`, { method: 'PUT' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al pagar la compra')
            }
            setSuccess('Compra registrada como pagada.')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar este movimiento? Se revertirá la cantidad en el stock del insumo y se borrará el gasto asociado si existía.')) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar el movimiento')
            }
            setSuccess('Movimiento eliminado y stock revertido.')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    const movimientosPorFecha = filterFecha ? movimientos.filter((m) => {
        const localDate = new Date(m.fecha)
        return localDate.toLocaleDateString('en-CA') === filterFecha
    }) : movimientos

    const filteredByInsumo = filterInsumo ? movimientosPorFecha.filter(m => m.insumo.id === filterInsumo) : movimientosPorFecha
    const filteredByPago = filterPago ? filteredByInsumo.filter(m => m.estadoPago === filterPago) : filteredByInsumo
    const filtered = filterTipo ? filteredByPago.filter((m) => m.tipo === filterTipo) : filteredByPago

    // Calcular stock por vencimiento para el insumo filtrado o todos
    const stockPorVto = (() => {
        const groups: Record<string, { fecha: string, cantidad: number, nombre: string }> = {}
        const targetMovs = filterInsumo ? movimientos.filter(m => m.insumo.id === filterInsumo) : movimientos

        targetMovs.forEach(m => {
            if (m.fechaVencimiento) {
                const key = m.fechaVencimiento
                if (!groups[key]) {
                    groups[key] = { fecha: key, cantidad: 0, nombre: m.insumo.nombre }
                }
                groups[key].cantidad += (m.tipo === 'entrada' ? m.cantidad : -m.cantidad)
            }
        })

        return Object.values(groups)
            .filter(g => g.cantidad > 0)
            .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    })()

    const statsEntradas = movimientosPorFecha.filter((m) => m.tipo === 'entrada').length
    const statsSalidas = movimientosPorFecha.filter((m) => m.tipo === 'salida').length

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando stock...</p></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>📊 Movimientos de Stock</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input
                        type="date"
                        className="form-input"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        title="Filtrar por fecha"
                        style={{ height: '38px' }}
                    />
                    <select
                        className="form-select"
                        value={filterInsumo}
                        onChange={(e) => setFilterInsumo(e.target.value)}
                        style={{ height: '38px', minWidth: '180px' }}
                    >
                        <option value="">Todos los Insumos</option>
                        {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                    </select>
                    {filterFecha && (
                        <button className="btn btn-ghost" onClick={() => setFilterFecha('')} title="Ver todas las fechas" style={{ padding: '0 8px', fontSize: '1.2rem' }}>
                            ✕
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null)
                        const defaultUbi = ubicaciones.find(u => u.nombre === selectedUbi)?.id || (ubicaciones.length > 0 ? ubicaciones[0].id : '')
                        setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', ubicacionId: defaultUbi })
                        setShowModal(true)
                    }}>+ Registrar Movimiento</button>
                </div>
            </div>

            {/* Selector de Ubicación / Sede */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', border: '1px solid var(--color-primary-light)', backgroundColor: 'var(--color-primary-bg-light)' }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
                    <div style={{ fontSize: '1.5rem' }}>📍</div>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>Filtrar por Punto de Venta / Sede</h3>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>Gestioná el stock específico de cada lugar.</p>
                    </div>
                    <select
                        className="form-select"
                        style={{ width: '250px', fontWeight: 600, border: '2px solid var(--color-primary)' }}
                        value={selectedUbi}
                        onChange={(e) => setSelectedUbi(e.target.value)}
                    >
                        <option value="">🌎 Todas las sedes (Global)</option>
                        {ubicaciones.map(u => (
                            <option key={u.id} value={u.nombre}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stock de Productos Terminados */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                    <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📦 Stock de Productos Terminados {selectedUbi && <span className="badge badge-primary">en {selectedUbi}</span>}
                    </h2>
                </div>
                {stockProductos.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--space-4)' }}>No hay stock de productos.</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                        {stockProductos.map(sp => {
                            const ubiName = selectedUbi || '';
                            const qty = selectedUbi ? (sp.ubicaciones[selectedUbi] || 0) : Object.values(sp.ubicaciones).reduce((a: any, b: any) => a + b, 0);
                            const isLowStock = sp.stockMinimo > 0 && qty < sp.stockMinimo;

                            if (selectedUbi && sp.ubicaciones[selectedUbi] === undefined) return null;

                            return (
                                <div key={`${sp.productoId}_${sp.presentacionId}`} className="card" style={{
                                    border: isLowStock ? '2px solid var(--color-danger)' : '1px solid var(--color-gray-200)',
                                    backgroundColor: isLowStock ? 'var(--color-danger-bg)' : 'var(--white)'
                                }}>
                                    <div className="card-body" style={{ padding: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{sp.codigoInterno}</span>
                                            <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', fontWeight: 600 }}>x{sp.cantidadPresentacion} unidades</span>
                                        </div>
                                        <h4 style={{ margin: 'var(--space-2) 0', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{sp.nombre}</h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-1)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: isLowStock ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                                                    {qty} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}>paq</span>
                                                </span>
                                            </div>
                                            {isLowStock && <span title="Stock bajo" style={{ fontSize: '1.2rem' }}>⚠️</span>}
                                        </div>
                                        {sp.stockMinimo > 0 && (
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', marginTop: '4px' }}>
                                                Mínimo: {sp.stockMinimo} paq
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }).filter(Boolean)}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>🧪 Stock de Insumos {selectedUbi && <span className="badge badge-primary">en {selectedUbi}</span>}</h2>
            </div>
            {insumos.length === 0 ? (
                <div className="empty-state">No hay insumos cargados</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                    {insumos.map((ins: any) => {
                        const stockFound = selectedUbi ? ins.stocks?.find((s: any) => s.ubicacion.nombre === selectedUbi) : null;
                        const qty = selectedUbi ? (stockFound?.cantidad || 0) : ins.stockActual;
                        const isLow = qty < ins.stockMinimo;

                        return (
                            <div key={ins.id} className="card" style={{ border: isLow ? '1px solid var(--color-danger)' : '1px solid var(--color-gray-200)' }}>
                                <div className="card-body" style={{ padding: 'var(--space-3)' }}>
                                    <h4 style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{ins.nombre}</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: isLow ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                                                {qty.toLocaleString('es-AR', { maximumFractionDigits: 2 })} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400 }}>{ins.unidadMedida}</span>
                                            </span>
                                            {ins.unidadSecundaria && (
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 600 }}>
                                                    {(selectedUbi ? (stockFound?.cantidadSecundaria || 0) : (ins.stockActualSecundario || 0)).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {ins.unidadSecundaria}
                                                </span>
                                            )}
                                        </div>
                                        {isLow && <span title="Stock bajo" style={{ color: 'var(--color-danger)' }}>⚠️</span>}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>📜 Historial de Movimientos</h2>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                <button className={`btn btn-sm ${filterTipo === '' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setFilterTipo('')}>
                    Todos ({movimientosPorFecha.length})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'entrada' ? '' : 'entrada')}
                    style={{ backgroundColor: filterTipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: filterTipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600 }}>
                    ⬆️ Entradas ({statsEntradas})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'salida' ? '' : 'salida')}
                    style={{ backgroundColor: filterTipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: filterTipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600 }}>
                    ⬇️ Salidas ({statsSalidas})
                </button>
                {filterPago === 'pendiente' && (
                    <button className="btn btn-sm" onClick={() => setFilterPago('')}
                        style={{ backgroundColor: '#E67E22', color: '#fff', border: '2px solid #E67E22', fontWeight: 600 }}>
                        ⏳ Solo Pendientes (Haga clic para quitar)
                    </button>
                )}
            </div>

            {stockPorVto.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: '#F8F9F9', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7E9' }}>
                    <h3 style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⏳ Stock por Vencimiento {filterInsumo && `(${insumos.find(i => i.id === filterInsumo)?.nombre})`}
                    </h3>
                    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        {stockPorVto.map((g, idx) => (
                            <div key={idx} className="badge" style={{
                                padding: '0.6rem 1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                backgroundColor: new Date(g.fecha) < new Date() ? '#E74C3C15' : '#F1C40F10',
                                color: new Date(g.fecha) < new Date() ? '#E74C3C' : '#D35400',
                                border: `1px solid ${new Date(g.fecha) < new Date() ? '#E74C3C' : '#F1C40F'}`,
                                gap: '2px'
                            }}>
                                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>{new Date(g.fecha).toLocaleDateString('es-AR')}</span>
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{g.cantidad} {filterInsumo ? insumos.find(i => i.id === filterInsumo)?.unidadMedida : ''}</span>
                                {!filterInsumo && <span style={{ fontSize: '10px' }}>{g.nombre}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Insumo</th>
                            <th>Cantidad</th>
                            <th>Costo / Pago</th>
                            <th>Vencimiento</th>
                            <th>Fecha</th>
                            <th>Proveedor</th>
                            <th>Observaciones</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay movimientos registrados</td></tr>
                        ) : filtered.map((mov) => (
                            <tr key={mov.id}>
                                <td>
                                    <span className="badge" style={{
                                        backgroundColor: mov.tipo === 'entrada' ? '#2ECC7120' : '#E74C3C20',
                                        color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C',
                                        border: `1px solid ${mov.tipo === 'entrada' ? '#2ECC7140' : '#E74C3C40'}`,
                                    }}>
                                        {mov.tipo === 'entrada' ? '⬆️ Entrada' : '⬇️ Salida'}
                                    </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{mov.insumo.nombre}</td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C', fontWeight: 700 }}>
                                            {mov.tipo === 'entrada' ? '+' : '−'}{mov.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {mov.insumo.unidadMedida}
                                        </span>
                                        {mov.cantidadSecundaria && (
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 600 }}>
                                                {mov.tipo === 'entrada' ? '+' : '−'}{mov.cantidadSecundaria.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {mov.insumo.unidadSecundaria}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    {mov.tipo === 'entrada' && mov.costoTotal ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 600 }}>${mov.costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                            {mov.estadoPago === 'pendiente' ? (
                                                <button onClick={() => handlePago(mov.id)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#F39C1220', color: '#E67E22', border: '1px solid #F39C12', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                                    ⏳ Pendiente (Pagar)
                                                </button>
                                            ) : (
                                                <span className="badge" style={{ backgroundColor: '#2ECC7120', color: '#27AE60', border: '1px solid #2ECC71', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                                    ✅ Pagado
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#aaa' }}>—</span>
                                    )}
                                </td>
                                <td>
                                    {mov.fechaVencimiento ? (
                                        <span className="badge" style={{
                                            backgroundColor: new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C20' : '#F1C40F20',
                                            color: new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C' : '#D35400',
                                            border: `1px solid ${new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C' : '#F1C40F'}`,
                                            fontWeight: 600
                                        }}>
                                            {new Date(mov.fechaVencimiento).toLocaleDateString('es-AR')}
                                            {new Date(mov.fechaVencimiento) < new Date() && ' (VENCIDO)'}
                                        </span>
                                    ) : <span style={{ color: '#aaa' }}>—</span>}
                                </td>
                                <td>{new Date(mov.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td>{mov.proveedor?.nombre || '—'}</td>
                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.observaciones || '—'}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleEdit(mov)}
                                            className="btn btn-icon btn-ghost"
                                            style={{ color: 'var(--color-primary)' }}
                                            title="Editar movimiento"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(mov.id)}
                                            className="btn btn-icon btn-ghost"
                                            style={{ color: '#E74C3C' }}
                                            title="Eliminar movimiento"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Editar' : 'Registrar'} Movimiento de Stock</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Tipo de movimiento</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm"
                                            disabled={!!editingId} // No permitir cambiar tipo al editar por seguridad
                                            onClick={() => setForm({ ...form, tipo: 'entrada' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: form.tipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600, opacity: editingId ? 0.6 : 1 }}>
                                            ⬆️ Entrada (compra/recepción)
                                        </button>
                                        <button type="button" className="btn btn-sm"
                                            disabled={!!editingId}
                                            onClick={() => setForm({ ...form, tipo: 'salida' })}
                                            style={{ flex: 1, backgroundColor: form.tipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: form.tipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600, opacity: editingId ? 0.6 : 1 }}>
                                            ⬇️ Salida (uso/merma)
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sede / Ubicación del movimiento</label>
                                    <select className="form-select" value={form.ubicacionId} onChange={(e) => setForm({ ...form, ubicacionId: e.target.value })} required>
                                        <option value="">Seleccionar sede...</option>
                                        {ubicaciones.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Insumo</label>
                                    <select className="form-select" value={form.insumoId} onChange={(e) => setForm({ ...form, insumoId: e.target.value })} required>
                                        <option value="">Seleccionar insumo...</option>
                                        {insumos.map((ins: any) => {
                                            const stockUbi = form.ubicacionId ? ins.stocks?.find((s: any) => s.ubicacionId === form.ubicacionId)?.cantidad || 0 : ins.stockActual;
                                            return (
                                                <option key={ins.id} value={ins.id}>
                                                    {ins.nombre} (stock: {stockUbi} {ins.unidadMedida})
                                                </option>
                                            )
                                        })}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    {form.useBultos ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>Bultos (Cajas/Maples)</label>
                                                <input type="number" step="0.01" className="form-input" value={form.bultos} onChange={(e) => setForm({ ...form, bultos: e.target.value })} required placeholder="Ej: 48" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 'var(--text-xs)' }}>U. por Bulto</label>
                                                <input type="number" step="0.01" className="form-input" value={form.unidadesPorBulto} onChange={(e) => setForm({ ...form, unidadesPorBulto: e.target.value })} required placeholder="Ej: 30" />
                                            </div>
                                            {form.bultos && form.unidadesPorBulto && (
                                                <div style={{ gridColumn: '1 / -1', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>
                                                    <strong>Total: {(parseFloat(form.bultos) * parseFloat(form.unidadesPorBulto)).toLocaleString('es-AR')}</strong> unidades/kg
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Cantidad ({insumos.find(i => i.id === form.insumoId)?.unidadMedida || 'u'})</label>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    className="form-input" 
                                                    value={form.cantidad} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const ins = insumos.find(i => i.id === form.insumoId);
                                                        let secVal = form.cantidadSecundaria;
                                                        if (ins?.factorConversion && val) {
                                                            secVal = String(parseFloat(val) / ins.factorConversion);
                                                        }
                                                        setForm({ ...form, cantidad: val, cantidadSecundaria: secVal });
                                                    }} 
                                                    required 
                                                    placeholder="0" 
                                                />
                                            </div>
                                            {insumos.find(i => i.id === form.insumoId)?.unidadSecundaria && (
                                                <div className="form-group">
                                                    <label className="form-label">En {insumos.find(i => i.id === form.insumoId)?.unidadSecundaria}</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.001" 
                                                        className="form-input" 
                                                        value={form.cantidadSecundaria} 
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const ins = insumos.find(i => i.id === form.insumoId);
                                                            let primVal = form.cantidad;
                                                            if (ins?.factorConversion && val) {
                                                                primVal = String(parseFloat(val) * ins.factorConversion);
                                                            }
                                                            setForm({ ...form, cantidadSecundaria: val, cantidad: primVal });
                                                        }} 
                                                        placeholder="0" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {form.tipo === 'entrada' && (
                                        <div className="form-group">
                                            <label className="form-label">Costo Total ($)</label>
                                            <input type="number" step="0.01" className="form-input" value={form.costoTotal} onChange={(e) => setForm({ ...form, costoTotal: e.target.value })} placeholder="0.00" />
                                            {form.costoTotal && form.insumoId && (form.cantidad || (form.useBultos && form.bultos && form.unidadesPorBulto)) && (
                                                <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>
                                                    Precio unitario calculado: <strong>${(parseFloat(form.costoTotal) / (form.useBultos ? parseFloat(form.bultos) * parseFloat(form.unidadesPorBulto) : parseFloat(form.cantidad))).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {insumos.find(i => i.id === form.insumoId)?.unidadMedida}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label">Fecha de Vencimiento</label>
                                        <input type="date" className="form-input" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} />
                                    </div>
                                </div>
                                <div style={{ marginBottom: 'var(--space-4)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                                        <input type="checkbox" checked={form.useBultos} onChange={(e) => setForm({ ...form, useBultos: e.target.checked })} />
                                        Ingresar cantidad en bultos (P. ej: Maples, Cajas, Packs)
                                    </label>
                                </div>
                                {form.tipo === 'entrada' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Proveedor</label>
                                            <select className="form-select" value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                                                <option value="">—</option>
                                                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Estado de Pago</label>
                                            <select className="form-select" value={form.estadoPago} onChange={(e) => setForm({ ...form, estadoPago: e.target.value })}>
                                                <option value="pagado">✅ Pagado (Contado)</option>
                                                <option value="pendiente">⏳ Pendiente (Cta. Cte.)</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                                <input type="checkbox" checked={form.actualizarCosto} onChange={(e) => setForm({ ...form, actualizarCosto: e.target.checked })} />
                                                Actualizar costo unitario del insumo
                                            </label>
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Observaciones</label>
                                    <input className="form-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional — motivo, # factura, etc." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">
                                    {editingId ? 'Guardar Cambios' : `Registrar ${form.tipo === 'entrada' ? 'entrada' : 'salida'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function StockPage() {
    return (
        <Suspense fallback={<div className="empty-state"><div className="spinner" /><p>Cargando filtros...</p></div>}>
            <StockContent />
        </Suspense>
    )
}
