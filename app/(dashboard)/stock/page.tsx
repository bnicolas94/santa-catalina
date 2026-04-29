'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Insumo { id: string; nombre: string; unidadMedida: string; stockActual: number; unidadSecundaria?: string; factorConversion?: number; stockActualSecundario?: number; stocks?: any[]; proveedor?: { id: string; nombre: string } }
interface Proveedor { id: string; nombre: string }
interface Movimiento {
    id: string; tipo: string; cantidad: number; cantidadSecundaria: number | null; fecha: string; observaciones: string | null
    costoTotal: number | null; estadoPago: string | null; fechaVencimiento: string | null; numeroFactura: string | null;
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
    const [cajas, setCajas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showFacturaModal, setShowFacturaModal] = useState(false)
    const [facturaForm, setFacturaForm] = useState({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] as any[], ubicacionId: '', observaciones: '', items: [] as any[] })
    const [tempItem, setTempItem] = useState({ insumoId: '', insumoNombre: '', cantidad: '', cantidadSecundaria: '', costoTotal: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '' })
    const [mostrarTodosInsumos, setMostrarTodosInsumos] = useState(false)
    const [isManualProveedor, setIsManualProveedor] = useState(false)
    const [isManualInsumo, setIsManualInsumo] = useState(false)
    const [filterTipo, setFilterTipo] = useState('')
    const [filterInsumo, setFilterInsumo] = useState('')
    const [filterFecha, setFilterFecha] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD local
    const [filterPago, setFilterPago] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '',
        costoTotal: '', estadoPago: 'pagado', actualizarCosto: true,
        useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'),
        ubicacionId: '', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] as any[],
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
            const [movRes, insRes, provRes, ubiRes, stockProdRes, cajasRes] = await Promise.all([
                fetch('/api/movimientos-stock'),
                fetch('/api/insumos'),
                fetch('/api/proveedores'),
                fetch('/api/ubicaciones'),
                fetch('/api/stock-producto'),
                fetch('/api/caja/saldos')
            ])
            const movData = await movRes.json()
            const insData = await insRes.json()
            const provData = await provRes.json()
            const ubiData = await ubiRes.json()
            const stockProdData = await stockProdRes.json()
            const cajasData = await cajasRes.json()

            setMovimientos(Array.isArray(movData) ? movData : [])
            setInsumos(Array.isArray(insData) ? insData : [])
            setProveedores(Array.isArray(provData) ? provData : [])
            setUbicaciones(Array.isArray(ubiData) ? ubiData : [])
            setStockProductos(Array.isArray(stockProdData) ? stockProdData : [])
            
            if (cajasData && !cajasData.error) {
                // Convertir el objeto de cajas en un array para el select
                const list = Object.values(cajasData).filter((c: any) => 
                    c && c.tipo && c.tipo !== 'caja_madre' && c.tipo !== 'local'
                )
                setCajas(list)
            }
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

            if (form.tipo === 'entrada' && form.estadoPago === 'pagado' && form.pagoDividido) {
                const totalCalculado = form.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0);
                if (Math.abs(totalCalculado - parseFloat(form.costoTotal || '0')) > 0.01) {
                    return setError('La suma de los pagos divididos debe ser exactamente igual al costo total ($' + parseFloat(form.costoTotal || '0').toLocaleString('es-AR') + ')');
                }
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
            setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), ubicacionId: '', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    const addItemToFactura = () => {
        if (!isManualInsumo && !tempItem.insumoId) return setError('Seleccione un insumo')
        if (isManualInsumo && !tempItem.insumoNombre) return setError('Ingrese el nombre del insumo')
        
        let finalCantidad = tempItem.cantidad;
        if (tempItem.useBultos) {
            if (!tempItem.bultos || !tempItem.unidadesPorBulto) return setError('Ingrese bultos y unidades')
            finalCantidad = String(parseFloat(tempItem.bultos) * parseFloat(tempItem.unidadesPorBulto))
        } else if (!tempItem.cantidad) {
            return setError('Ingrese cantidad')
        }

        const insData = insumos.find(i => i.id === tempItem.insumoId)
        const itemToAdd = { 
            ...tempItem, 
            cantidad: finalCantidad,
            insumoNombre: isManualInsumo ? tempItem.insumoNombre : insData?.nombre,
            unidadMedida: insData?.unidadMedida || 'u',
            unidadSecundaria: insData?.unidadSecundaria
        }

        setFacturaForm({ ...facturaForm, items: [...facturaForm.items, itemToAdd] })
        setTempItem({ insumoId: '', insumoNombre: '', cantidad: '', cantidadSecundaria: '', costoTotal: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '' })
        setIsManualInsumo(false)
    }

    const removeFacturaItem = (index: number) => {
        const newItems = [...facturaForm.items]
        newItems.splice(index, 1)
        setFacturaForm({ ...facturaForm, items: newItems })
    }

    async function handleFacturaSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!isManualProveedor && !facturaForm.proveedorId) return setError('Seleccione un proveedor')
        if (isManualProveedor && !facturaForm.proveedorNombre) return setError('Ingrese el nombre del proveedor manual')
        if (facturaForm.items.length === 0) return setError('Debe agregar al menos un insumo a la factura')
        
        if (facturaForm.estadoPago === 'pagado' && facturaForm.pagoDividido) {
            const totalFactura = facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0);
            const totalPagos = facturaForm.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0);
            if (Math.abs(totalFactura - totalPagos) > 0.01) {
                return setError('La suma de los pagos divididos debe ser exactamente igual al total de la factura ($' + totalFactura.toLocaleString('es-AR') + ')');
            }
        }

        try {
            const res = await fetch('/api/movimientos-stock/factura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(facturaForm),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Factura registrada correctamente')
            setShowFacturaModal(false)
            setFacturaForm({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }], ubicacionId: '', observaciones: '', items: [] })
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
            fechaMovimiento: mov.fecha ? new Date(mov.fecha).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA'),
            ubicacionId: mov.ubicacion?.id || '',
            cajaOrigen: 'caja_chica',
            pagoDividido: false,
            pagos: [{ cajaOrigen: 'caja_chica', monto: '' }],
        })
        setShowModal(true)
    }

    async function handlePago(id: string) {
        if (cajas.length === 0) return setError('No hay cajas disponibles para realizar el pago')
        
        const opcionesStr = cajas.map((c, i) => `${i + 1} = ${c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}`).join('\n')
        const resp = prompt(`¿De qué caja sale el pago?\n\n${opcionesStr}\n\nIngresá el número:`, '1')
        if (!resp) return
        
        const idx = parseInt(resp.trim()) - 1
        if (isNaN(idx) || idx < 0 || idx >= cajas.length) return setError('Opción inválida')
        
        const selectedBox = cajas[idx]
        const label = selectedBox.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        
        if (!confirm(`¿Marcar compra como pagada desde ${label}?`)) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}/pago`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cajaOrigen: selectedBox.tipo })
            })
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
                    <button className="btn btn-primary" style={{ backgroundColor: '#8E44AD', borderColor: '#8E44AD' }} onClick={() => {
                        const defaultUbi = ubicaciones.find(u => u.nombre === selectedUbi)?.id || (ubicaciones.length > 0 ? ubicaciones[0].id : '')
                        setFacturaForm({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }], ubicacionId: defaultUbi, observaciones: '', items: [] })
                        setTempItem({ insumoId: '', insumoNombre: '', cantidad: '', cantidadSecundaria: '', costoTotal: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '' })
                        setMostrarTodosInsumos(false)
                        setIsManualProveedor(false)
                        setIsManualInsumo(false)
                        setShowFacturaModal(true)
                    }}>📑 Múltiples</button>
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null)
                        const defaultUbi = ubicaciones.find(u => u.nombre === selectedUbi)?.id || (ubicaciones.length > 0 ? ubicaciones[0].id : '')
                        setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), ubicacionId: defaultUbi, cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] })
                        setShowModal(true)
                    }}>+ Simple</button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '1.5rem' }}>📍</div>
                    <div style={{ flex: '1 1 200px' }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700 }}>Filtrar por Punto de Venta / Sede</h3>
                        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>Gestioná el stock específico de cada lugar.</p>
                    </div>
                    <select
                        className="form-select"
                        style={{ flex: '1 1 200px', fontWeight: 600, border: '2px solid var(--color-primary)', height: '40px' }}
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
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                <button className={`btn btn-sm ${filterTipo === '' ? 'btn-secondary' : 'btn-ghost'}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setFilterTipo('')}>
                    Todos ({movimientosPorFecha.length})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'entrada' ? '' : 'entrada')}
                    style={{ whiteSpace: 'nowrap', backgroundColor: filterTipo === 'entrada' ? '#2ECC71' : '#2ECC7118', color: filterTipo === 'entrada' ? '#fff' : '#2ECC71', border: '2px solid #2ECC71', fontWeight: 600 }}>
                    ⬆️ Entradas ({statsEntradas})
                </button>
                <button className="btn btn-sm" onClick={() => setFilterTipo(filterTipo === 'salida' ? '' : 'salida')}
                    style={{ whiteSpace: 'nowrap', backgroundColor: filterTipo === 'salida' ? '#E74C3C' : '#E74C3C18', color: filterTipo === 'salida' ? '#fff' : '#E74C3C', border: '2px solid #E74C3C', fontWeight: 600 }}>
                    ⬇️ Salidas ({statsSalidas})
                </button>
                {filterPago === 'pendiente' && (
                    <button className="btn btn-sm" onClick={() => setFilterPago('')}
                        style={{ whiteSpace: 'nowrap', backgroundColor: '#E67E22', color: '#fff', border: '2px solid #E67E22', fontWeight: 600 }}>
                        ⏳ Pendientes
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
                            <th>Costo</th>
                            <th className="hidden-mobile">Vto.</th>
                            <th className="hidden-mobile">Fecha</th>
                            <th className="hidden-mobile">Proveedor</th>
                            <th className="hidden-mobile">Observaciones</th>
                            <th style={{ textAlign: 'right' }}>Acc.</th>
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
                                <td style={{ fontWeight: 600 }}>
                                    {mov.insumo.nombre}
                                    <div className="visible-mobile" style={{ fontSize: '10px', color: 'var(--color-gray-500)', fontWeight: 400 }}>
                                        {mov.proveedor?.nombre || 'S/Prov.'} • {new Date(mov.fecha).toLocaleDateString('es-AR')}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: mov.tipo === 'entrada' ? '#2ECC71' : '#E74C3C', fontWeight: 700 }}>
                                            {mov.tipo === 'entrada' ? '+' : '−'}{mov.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {mov.insumo.unidadMedida}
                                        </span>
                                        {mov.cantidadSecundaria && (
                                            <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', fontWeight: 600 }}>
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
                                <td className="hidden-mobile">
                                    {mov.fechaVencimiento ? (
                                        <span className="badge" style={{
                                            backgroundColor: new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C20' : '#F1C40F20',
                                            color: new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C' : '#D35400',
                                            border: `1px solid ${new Date(mov.fechaVencimiento) < new Date() ? '#E74C3C' : '#F1C40F'}`,
                                            fontWeight: 600,
                                            fontSize: '9px'
                                        }}>
                                            {new Date(mov.fechaVencimiento).toLocaleDateString('es-AR')}
                                        </span>
                                    ) : <span style={{ color: '#aaa' }}>—</span>}
                                </td>
                                <td className="hidden-mobile">{new Date(mov.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                <td className="hidden-mobile">
                                    {mov.proveedor?.nombre || '—'}
                                    {mov.numeroFactura && <div style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>Fac: {mov.numeroFactura}</div>}
                                </td>
                                <td className="hidden-mobile" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.observaciones || '—'}</td>
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
                                        <label className="form-label">Fecha del Movimiento</label>
                                        <input type="date" className="form-input" value={form.fechaMovimiento} onChange={(e) => setForm({ ...form, fechaMovimiento: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} required />
                                    </div>
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
                                        {form.estadoPago === 'pagado' && (
                                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <label className="form-label" style={{ margin: 0, fontSize: 'var(--text-xs)' }}>¿De qué caja sale el pago?</label>
                                                    <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                        <input type="checkbox" checked={form.pagoDividido} onChange={(e) => setForm({ ...form, pagoDividido: e.target.checked })} />
                                                        Pago Dividido
                                                    </label>
                                                </div>
                                                
                                                {!form.pagoDividido ? (
                                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                        {cajas.length > 0 ? (
                                                            cajas.map((c) => {
                                                                const isMP = c.tipo === 'mercado_pago';
                                                                const color = isMP ? '#3498DB' : (c.tipo === 'caja_madre' ? '#8E44AD' : (c.tipo === 'caja_chica' ? '#E67E22' : '#27AE60'));
                                                                const label = c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                                                return (
                                                                    <button key={c.tipo} type="button" className="btn btn-sm"
                                                                        onClick={() => setForm({ ...form, cajaOrigen: c.tipo })}
                                                                        style={{ 
                                                                            flex: '1 1 100px', 
                                                                            backgroundColor: form.cajaOrigen === c.tipo ? color : `${color}18`, 
                                                                            color: form.cajaOrigen === c.tipo ? '#fff' : color, 
                                                                            border: `2px solid ${color}`, 
                                                                            fontWeight: 600, 
                                                                            fontSize: '0.75rem',
                                                                            padding: '6px 4px'
                                                                        }}>
                                                                        {isMP ? '💳 ' : '🏦 '}{label}
                                                                    </button>
                                                                );
                                                            })
                                                        ) : (
                                                            [
                                                                { key: 'caja_madre', label: '🏦 Madre', color: '#8E44AD' },
                                                                { key: 'caja_chica', label: '💼 Chica', color: '#E67E22' },
                                                                { key: 'local', label: '🏪 Local', color: '#27AE60' }
                                                            ].map((c) => (
                                                                <button key={c.key} type="button" className="btn btn-sm"
                                                                    onClick={() => setForm({ ...form, cajaOrigen: c.key })}
                                                                    style={{ flex: 1, backgroundColor: form.cajaOrigen === c.key ? c.color : `${c.color}18`, color: form.cajaOrigen === c.key ? '#fff' : c.color, border: `2px solid ${c.color}`, fontWeight: 600, fontSize: '0.8rem' }}>
                                                                    {c.label}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                        {form.pagos.map((p, idx) => (
                                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: 'var(--space-2)' }}>
                                                                <select className="form-select" value={p.cajaOrigen} onChange={(e) => {
                                                                    const newPagos = [...form.pagos];
                                                                    newPagos[idx].cajaOrigen = e.target.value;
                                                                    setForm({ ...form, pagos: newPagos });
                                                                }}>
                                                                    {cajas.length > 0 ? cajas.map(c => <option key={c.tipo} value={c.tipo}>{c.tipo === 'mercado_pago' ? '💳 ' : '🏦 '} {c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>) : <><option value="caja_madre">Caja Madre</option><option value="caja_chica">Caja Chica</option><option value="local">Local</option></>}
                                                                </select>
                                                                <input type="number" step="0.01" className="form-input" placeholder="Monto ($)" value={p.monto} onChange={(e) => {
                                                                    const newPagos = [...form.pagos];
                                                                    newPagos[idx].monto = e.target.value;
                                                                    setForm({ ...form, pagos: newPagos });
                                                                }} />
                                                                {idx > 0 && <button type="button" className="btn btn-icon btn-ghost" onClick={() => {
                                                                    const newPagos = [...form.pagos];
                                                                    newPagos.splice(idx, 1);
                                                                    setForm({ ...form, pagos: newPagos });
                                                                }} style={{ color: 'var(--color-danger)' }}>✕</button>}
                                                            </div>
                                                        ))}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm({ ...form, pagos: [...form.pagos, { cajaOrigen: cajas.length > 0 ? cajas[0].tipo : 'caja_chica', monto: '' }] })} style={{ color: 'var(--color-primary)' }}>+ Agregar otra caja</button>
                                                            {form.costoTotal && (
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: Math.abs(form.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0) - parseFloat(form.costoTotal || '0')) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                                    Total asignado: ${form.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} / ${parseFloat(form.costoTotal || '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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

            {/* Modal Factura Multiple */}
            {showFacturaModal && (
                <div className="modal-overlay" onClick={() => setShowFacturaModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
                        <div className="modal-header">
                            <h2>📑 Registrar Factura Múltiple</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowFacturaModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleFacturaSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Sede de entrada</label>
                                        <select className="form-select" value={facturaForm.ubicacionId} onChange={(e) => setFacturaForm({ ...facturaForm, ubicacionId: e.target.value })} required>
                                            <option value="">Seleccionar sede...</option>
                                            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <label className="form-label" style={{ margin: 0 }}>Proveedor</label>
                                            <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)' }}>
                                                <input type="checkbox" checked={isManualProveedor} onChange={(e) => {
                                                    setIsManualProveedor(e.target.checked);
                                                    setFacturaForm({ ...facturaForm, proveedorId: '', proveedorNombre: '' });
                                                }} />
                                                Ingresar manual
                                            </label>
                                        </div>
                                        {isManualProveedor ? (
                                            <input className="form-input" placeholder="Nombre completo" value={facturaForm.proveedorNombre || ''} onChange={(e) => setFacturaForm({ ...facturaForm, proveedorNombre: e.target.value })} required />
                                        ) : (
                                            <select className="form-select" value={facturaForm.proveedorId} onChange={(e) => setFacturaForm({ ...facturaForm, proveedorId: e.target.value })} required>
                                                <option value="">Seleccionar proveedor...</option>
                                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nº Factura / Remito</label>
                                        <input className="form-input" value={facturaForm.numeroFactura} onChange={(e) => setFacturaForm({ ...facturaForm, numeroFactura: e.target.value })} placeholder="Opcional" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Estado de Pago</label>
                                        <select className="form-select" value={facturaForm.estadoPago} onChange={(e) => setFacturaForm({ ...facturaForm, estadoPago: e.target.value })}>
                                            <option value="pagado">✅ Pagado (Contado)</option>
                                            <option value="pendiente">⏳ Pendiente (Cta. Cte.)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha del Movimiento</label>
                                        <input type="date" className="form-input" value={facturaForm.fechaMovimiento} onChange={(e) => setFacturaForm({ ...facturaForm, fechaMovimiento: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} required />
                                    </div>
                                    {facturaForm.estadoPago === 'pagado' && (
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <label className="form-label" style={{ margin: 0 }}>Caja de Origen</label>
                                                <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600 }}>
                                                    <input type="checkbox" checked={facturaForm.pagoDividido} onChange={(e) => setFacturaForm({ ...facturaForm, pagoDividido: e.target.checked })} />
                                                    Pago Dividido
                                                </label>
                                            </div>
                                            
                                            {!facturaForm.pagoDividido ? (
                                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                    {cajas.length > 0 ? (
                                                        cajas.map((c) => {
                                                            const isMP = c.tipo === 'mercado_pago';
                                                            const color = isMP ? '#3498DB' : (c.tipo === 'caja_madre' ? '#8E44AD' : (c.tipo === 'caja_chica' ? '#E67E22' : '#27AE60'));
                                                            const label = c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                                            return (
                                                                <button key={c.tipo} type="button" className="btn btn-sm"
                                                                    onClick={() => setFacturaForm({ ...facturaForm, cajaOrigen: c.tipo })}
                                                                    style={{ 
                                                                        flex: '1 1 120px', 
                                                                        backgroundColor: facturaForm.cajaOrigen === c.tipo ? color : `${color}18`, 
                                                                        color: facturaForm.cajaOrigen === c.tipo ? '#fff' : color, 
                                                                        border: `2px solid ${color}`, 
                                                                        fontWeight: 600, 
                                                                        fontSize: '0.8rem',
                                                                        padding: '8px 4px'
                                                                    }}>
                                                                    {isMP ? '💳 ' : '🏦 '}{label}
                                                                </button>
                                                            );
                                                        })
                                                    ) : (
                                                        <select className="form-select" value={facturaForm.cajaOrigen} onChange={(e) => setFacturaForm({ ...facturaForm, cajaOrigen: e.target.value })}>
                                                            <option value="caja_madre">Caja Madre</option>
                                                            <option value="caja_chica">Caja Chica</option>
                                                            <option value="local">Local</option>
                                                        </select>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                                    {facturaForm.pagos.map((p, idx) => (
                                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: 'var(--space-2)' }}>
                                                            <select className="form-select" value={p.cajaOrigen} onChange={(e) => {
                                                                const newPagos = [...facturaForm.pagos];
                                                                newPagos[idx].cajaOrigen = e.target.value;
                                                                setFacturaForm({ ...facturaForm, pagos: newPagos });
                                                            }}>
                                                                {cajas.length > 0 ? cajas.map(c => <option key={c.tipo} value={c.tipo}>{c.tipo === 'mercado_pago' ? '💳 ' : '🏦 '} {c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</option>) : <><option value="caja_madre">Caja Madre</option><option value="caja_chica">Caja Chica</option><option value="local">Local</option></>}
                                                            </select>
                                                            <input type="number" step="0.01" className="form-input" placeholder="Monto ($)" value={p.monto} onChange={(e) => {
                                                                const newPagos = [...facturaForm.pagos];
                                                                newPagos[idx].monto = e.target.value;
                                                                setFacturaForm({ ...facturaForm, pagos: newPagos });
                                                            }} />
                                                            {idx > 0 && <button type="button" className="btn btn-icon btn-ghost" onClick={() => {
                                                                const newPagos = [...facturaForm.pagos];
                                                                newPagos.splice(idx, 1);
                                                                setFacturaForm({ ...facturaForm, pagos: newPagos });
                                                            }} style={{ color: 'var(--color-danger)' }}>✕</button>}
                                                        </div>
                                                    ))}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFacturaForm({ ...facturaForm, pagos: [...facturaForm.pagos, { cajaOrigen: cajas.length > 0 ? cajas[0].tipo : 'caja_chica', monto: '' }] })} style={{ color: 'var(--color-primary)' }}>+ Agregar otra caja</button>
                                                        {facturaForm.items.length > 0 && (
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: Math.abs(facturaForm.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0) - facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0)) < 0.01 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                                Total asignado: ${facturaForm.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })} / ${facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <hr style={{ margin: 'var(--space-4) 0' }} />

                                {/* Seleccion de Insumos */}
                                <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>🛒 Agregar Insumos al carro</h3>
                                <div style={{ padding: 'var(--space-3)', backgroundColor: '#F8F9F9', borderRadius: 'var(--radius-md)', border: '1px solid #E5E7E9', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Insumo</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {!isManualInsumo && (
                                                        <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)' }}>
                                                            <input type="checkbox" checked={mostrarTodosInsumos} onChange={(e) => setMostrarTodosInsumos(e.target.checked)} />
                                                            Todos
                                                        </label>
                                                    )}
                                                    <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-primary)' }}>
                                                        <input type="checkbox" checked={isManualInsumo} onChange={(e) => {
                                                            setIsManualInsumo(e.target.checked);
                                                            setTempItem({ ...tempItem, insumoId: '', insumoNombre: '' })
                                                        }} />
                                                        Manual
                                                    </label>
                                                </div>
                                            </div>
                                            {isManualInsumo ? (
                                                <input className="form-input" placeholder="Nombre (Ej: Escoba)" value={tempItem.insumoNombre || ''} onChange={(e) => setTempItem({ ...tempItem, insumoNombre: e.target.value })} />
                                            ) : (
                                                <select className="form-select" value={tempItem.insumoId} onChange={(e) => {
                                                    const id = e.target.value;
                                                    const ins = insumos.find(i => i.id === id);
                                                    setTempItem({ ...tempItem, insumoId: id, useBultos: false, bultos: '', unidadesPorBulto: '', cantidad: '', cantidadSecundaria: '' });
                                                }}>
                                                    <option value="">Seleccionar insumo...</option>
                                                    {insumos.filter(i => mostrarTodosInsumos || !facturaForm.proveedorId || i.proveedor?.id === facturaForm.proveedorId).map((ins) => (
                                                        <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidadMedida})</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>

                                        {tempItem.useBultos ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>Bultos</label>
                                                    <input type="number" step="0.01" className="form-input" value={tempItem.bultos} onChange={(e) => setTempItem({ ...tempItem, bultos: e.target.value })} placeholder="Ej: 10" />
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>Cant. x Bulto</label>
                                                    <input type="number" step="0.01" className="form-input" value={tempItem.unidadesPorBulto} onChange={(e) => setTempItem({ ...tempItem, unidadesPorBulto: e.target.value })} placeholder="Ej: 12" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: tempItem.insumoId && insumos.find(i => i.id === tempItem.insumoId)?.unidadSecundaria ? '1fr 1fr' : '1fr', gap: 'var(--space-2)' }}>
                                                <div className="form-group" style={{ marginBottom: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>
                                                        Cant. ({!isManualInsumo && tempItem.insumoId ? insumos.find(i => i.id === tempItem.insumoId)?.unidadMedida : 'unid'})
                                                    </label>
                                                    <input 
                                                        type="number" 
                                                        step="0.001" 
                                                        className="form-input" 
                                                        value={tempItem.cantidad} 
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const ins = insumos.find(i => i.id === tempItem.insumoId);
                                                            let secVal = tempItem.cantidadSecundaria;
                                                            if (ins?.factorConversion && val) {
                                                                secVal = String(parseFloat(val) / ins.factorConversion);
                                                            }
                                                            setTempItem({ ...tempItem, cantidad: val, cantidadSecundaria: secVal });
                                                        }} 
                                                        placeholder="0" 
                                                    />
                                                </div>
                                                {!isManualInsumo && tempItem.insumoId && insumos.find(i => i.id === tempItem.insumoId)?.unidadSecundaria && (
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>En {insumos.find(i => i.id === tempItem.insumoId)?.unidadSecundaria}</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.001" 
                                                            className="form-input" 
                                                            value={tempItem.cantidadSecundaria} 
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const ins = insumos.find(i => i.id === tempItem.insumoId);
                                                                let primVal = tempItem.cantidad;
                                                                if (ins?.factorConversion && val) {
                                                                    primVal = String(parseFloat(val) * ins.factorConversion);
                                                                }
                                                                setTempItem({ ...tempItem, cantidadSecundaria: val, cantidad: primVal });
                                                            }} 
                                                            placeholder="0" 
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>Costo Total ($)</label>
                                            <input type="number" step="0.01" className="form-input" value={tempItem.costoTotal} onChange={(e) => setTempItem({ ...tempItem, costoTotal: e.target.value })} placeholder="Ej: 5000" />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            {!isManualInsumo && (
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)' }}>
                                                    <input type="checkbox" checked={tempItem.useBultos} onChange={(e) => setTempItem({ ...tempItem, useBultos: e.target.checked })} />
                                                    Ingresar en bultos (Maples, Cajas, Packs)
                                                </label>
                                            )}
                                            {tempItem.useBultos && tempItem.bultos && tempItem.unidadesPorBulto && (
                                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-primary)' }}>
                                                    Total calculado: {(parseFloat(tempItem.bultos) * parseFloat(tempItem.unidadesPorBulto)).toLocaleString('es-AR')} {insumos.find(i => i.id === tempItem.insumoId)?.unidadMedida}
                                                </span>
                                            )}
                                        </div>
                                        <button type="button" className="btn btn-sm btn-ghost" onClick={addItemToFactura} style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '4px 12px' }}>+ Agregar a Factura</button>
                                    </div>
                                </div>

                                {/* Lista de Insumos agregados */}
                                {facturaForm.items.length > 0 && (
                                    <table className="table" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
                                        <thead>
                                            <tr>
                                                <th>Insumo</th>
                                                <th>Cantidad</th>
                                                <th>Costo</th>
                                                <th>Subtotal</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {facturaForm.items.map((it, idx) => {
                                                const insData = insumos.find(i => i.id === it.insumoId)
                                                return (
                                                    <tr key={idx}>
                                                        <td>
                                                            <div style={{ fontWeight: 600 }}>{it.insumoNombre || insData?.nombre}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)' }}>Vto: {it.fechaVencimiento || '—'}</div>
                                                        </td>
                                                        <td>
                                                            <div>{it.cantidad} {it.unidadMedida}</div>
                                                            {it.cantidadSecundaria && (
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                                                                    ({it.cantidadSecundaria} {it.unidadSecundaria})
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>${parseFloat(it.costoTotal || '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                        <td>
                                                            {it.costoTotal && it.cantidad ? (
                                                                <div style={{ fontSize: '0.8rem' }}>
                                                                    ${(parseFloat(it.costoTotal) / parseFloat(it.cantidad)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {it.unidadMedida}
                                                                </div>
                                                            ) : '—'}
                                                        </td>
                                                        <td><button type="button" className="btn btn-icon btn-ghost" onClick={() => removeFacturaItem(idx)} style={{ color: 'var(--color-danger)' }}>✕</button></td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Factura:</td>
                                                <td colSpan={3} style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.2rem' }}>
                                                    ${facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0).toLocaleString('es-AR')}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowFacturaModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Registrar Factura Completa</button>
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
