'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ImportarPedidosModal from '@/components/pedidos/ImportarPedidosModal'

interface Presentacion {
    id: string; cantidad: number; precioVenta: number
    producto: { id: string; nombre: string; codigoInterno: string; alias?: string | null }
}
interface Cliente { id: string; nombreComercial: string }
interface DetallePedido {
    id: string; cantidad: number; precioUnitario: number
    observaciones?: string | null
    presentacion: Presentacion
    nroPack?: number | null
}
interface Pedido {
    id: string; fechaPedido: string; fechaEntrega: string; estado: string
    medioPago: string | null; totalUnidades: number; totalImporte: number
    totalPacks: number; cliente: Cliente; detalles: DetallePedido[]; abonado: boolean
    turno: string | null
}

type SortField = 'cliente' | 'fechaEntrega' | 'totalUnidades' | 'totalImporte' | 'turno'
type SortDir = 'asc' | 'desc'
interface Producto {
    id: string; nombre: string; codigoInterno: string
    presentaciones: { id: string; cantidad: number; precioVenta: number }[]
}

const ESTADOS_PEDIDO = [
    { value: 'pendiente', label: 'Pendiente', color: '#F39C12', emoji: '🟡' },
    { value: 'confirmado', label: 'Confirmado', color: '#3498DB', emoji: '✅' },
    { value: 'en_ruta', label: 'En ruta', color: '#9B59B6', emoji: '🚛' },
    { value: 'entregado', label: 'Entregado', color: '#2ECC71', emoji: '📦' },
    { value: 'rechazado', label: 'Rechazado', color: '#E74C3C', emoji: '❌' },
]

function getEstadoInfo(estado: string) {
    return ESTADOS_PEDIDO.find((e) => e.value === estado) || { value: estado, label: estado, color: '#607D8B', emoji: '❓' }
}

export default function PedidosPage() {
    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [filterEstado, setFilterEstado] = useState('')
    const [detalles, setDetalles] = useState<{ presentacionId: string; cantidad: string }[]>([{ presentacionId: '', cantidad: '1' }])
    const [form, setForm] = useState({ clienteId: '', fechaEntrega: '', medioPago: 'efectivo' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [editingPedido, setEditingPedido] = useState<Pedido | null>(null)
    const [editForm, setEditForm] = useState({ fechaEntrega: '', medioPago: 'efectivo', estado: 'pendiente' })
    const [showEditModal, setShowEditModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Paginación y Filtros
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalRecords, setTotalRecords] = useState(0)
    const today = new Date().toISOString().split('T')[0]
    const [fechaDesde, setFechaDesde] = useState(today)
    const [fechaHasta, setFechaHasta] = useState(today)
    const ITEMS_PER_PAGE = 20

    // Stats de proyección
    const [stats, setStats] = useState({ totalPedidos: 0, totalImporte: 0, totalUnidades: 0, totalPacks: 0 })

    // Sorting
    const [sortField, setSortField] = useState<SortField | ''>('')
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    useEffect(() => { fetchPedidos() }, [currentPage, filterEstado, fechaDesde, fechaHasta, sortField, sortDir])
    useEffect(() => { fetchCatalogos() }, [])

    // Debounce para búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1)
            fetchPedidos()
        }, 400)
        return () => clearTimeout(timer)
    }, [searchTerm])

    async function fetchCatalogos() {
        try {
            const [cliRes, prodRes] = await Promise.all([
                fetch('/api/clientes'), fetch('/api/productos'),
            ])
            const cliData = await cliRes.json()
            const prodData = await prodRes.json()
            setClientes(Array.isArray(cliData) ? cliData : [])
            setProductos(Array.isArray(prodData) ? prodData : [])
        } catch { setError('Error al cargar catálogos') }
    }

    async function fetchPedidos() {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            params.set('page', String(currentPage))
            params.set('limit', String(ITEMS_PER_PAGE))
            if (filterEstado) params.set('estado', filterEstado)
            if (fechaDesde) params.set('fechaDesde', fechaDesde)
            if (fechaHasta) params.set('fechaHasta', fechaHasta)
            if (searchTerm) params.set('search', searchTerm)
            if (sortField) { params.set('sortField', sortField); params.set('sortDir', sortDir) }

            const res = await fetch(`/api/pedidos?${params.toString()}`)
            const data = await res.json()

            if (data.pedidos) {
                setPedidos(data.pedidos)
                setTotalPages(data.pagination.pages)
                setTotalRecords(data.pagination.total)
                setStats(data.stats)
            } else {
                // Fallback por si la API responde en formato viejo
                setPedidos(Array.isArray(data) ? data : [])
            }
        } catch { setError('Error al cargar pedidos') } finally { setLoading(false) }
    }

    async function fetchData() { await fetchPedidos() }

    function toggleSort(field: SortField) {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
        setCurrentPage(1)
    }

    function SortIcon({ field }: { field: SortField }) {
        if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>⇅</span>
        return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
    }


    // Flatten all presentations for selection
    const allPresentaciones = productos.flatMap((p) =>
        p.presentaciones.map((pres) => ({
            ...pres,
            productoNombre: p.nombre,
            productoCodigo: p.codigoInterno,
        }))
    )

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        const validDetalles = detalles.filter((d) => d.presentacionId && d.cantidad)
        if (!validDetalles.length) { setError('Agregá al menos un producto'); return }
        try {
            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, detalles: validDetalles }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess('Pedido creado')
            setShowModal(false)
            setForm({ clienteId: '', fechaEntrega: '', medioPago: 'efectivo' })
            setDetalles([{ presentacionId: '', cantidad: '1' }])
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function cambiarEstado(pedidoId: string, nuevoEstado: string) {
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado }),
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data && data.id) {
                setPedidos(prev => prev.map(p => (p && p.id === pedidoId) ? data : p))
            }
            setSuccess('Estado actualizado')
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al actualizar estado') }
    }

    async function marcarAbonado(pedidoId: string) {
        if (!confirm('¿Marcar este pedido como abonado? Se registrará un ingreso en la caja de Mercado Pago Juani.')) return
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ abonado: true, medioPago: 'transferencia' }),
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data && data.id) {
                setPedidos(prev => prev.map(p => (p && p.id === pedidoId) ? data : p))
            }
            setSuccess('Pedido marcado como abonado')
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al marcar como abonado') }
    }

    async function toggleMedioPago(pedidoId: string, nuevoMedio: string) {
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medioPago: nuevoMedio }),
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data && data.id) {
                setPedidos(prev => prev.map(p => (p && p.id === pedidoId) ? data : p))
            }
            setSuccess(`Medio de pago cambiado a ${nuevoMedio === 'efectivo' ? 'Efectivo' : 'Transferencia'}`)
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al cambiar medio de pago') }
    }

    function startEditPedido(ped: Pedido) {
        setEditingPedido(ped)
        setEditForm({
            fechaEntrega: new Date(ped.fechaEntrega).toISOString().split('T')[0],
            medioPago: ped.medioPago || 'efectivo',
            estado: ped.estado,
        })
        setShowEditModal(true)
    }

    async function handleEditPedido(e: React.FormEvent) {
        e.preventDefault()
        if (!editingPedido) return
        try {
            const res = await fetch(`/api/pedidos/${editingPedido.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            setSuccess('Pedido actualizado')
            setShowEditModal(false)
            if (data && data.id) {
                setPedidos(prev => prev.map(p => (p && p.id === editingPedido.id) ? data : p))
            }
            setEditingPedido(null)
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al editar pedido') }
    }

    async function handleDeletePedido(id: string) {
        if (!confirm('¿Eliminar este pedido? Se borrarán todos sus detalles.')) return
        try {
            const res = await fetch(`/api/pedidos/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setSuccess('Pedido eliminado')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch { setError('Error al eliminar pedido') }
    }

    async function handleLimpiarPedidos() {
        if (filtered.length === 0) return;
        const fechaLabel = fechaDesde === fechaHasta && fechaDesde
            ? new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-AR')
            : fechaDesde && fechaHasta
                ? `${new Date(fechaDesde + 'T12:00:00').toLocaleDateString('es-AR')} al ${new Date(fechaHasta + 'T12:00:00').toLocaleDateString('es-AR')}`
                : 'visibles';
        const confirmMsg = `¿Eliminar los ${totalRecords} pedidos del ${fechaLabel}${filterEstado ? ` (${getEstadoInfo(filterEstado).label})` : ''}?`;
        
        if (!confirm(confirmMsg)) return;

        try {
            setLoading(true);
            // Eliminamos solo los pedidos de la vista actual (filtrados por fecha/estado)
            const ids = filtered.map(p => p.id);
            
            // Si hay más páginas, hay que traer TODOS los ids del filtro actual
            let allIds = ids;
            if (totalRecords > filtered.length) {
                const params = new URLSearchParams()
                params.set('page', '1')
                params.set('limit', String(totalRecords))
                if (filterEstado) params.set('estado', filterEstado)
                if (fechaDesde) params.set('fechaDesde', fechaDesde)
                if (fechaHasta) params.set('fechaHasta', fechaHasta)
                if (searchTerm) params.set('search', searchTerm)
                const allRes = await fetch(`/api/pedidos?${params.toString()}`)
                const allData = await allRes.json()
                allIds = allData.pedidos?.map((p: any) => p.id) || ids
            }

            const res = await fetch('/api/pedidos', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: allIds }),
            });
            if (!res.ok) throw new Error();
            setSuccess(`${allIds.length} pedidos eliminados`);
            fetchData();
            setTimeout(() => setSuccess(''), 3000);
        } catch { 
            setError('Error al eliminar pedidos de forma masiva');
        } finally {
            setLoading(false);
        }
    }

    function addDetalle() { setDetalles([...detalles, { presentacionId: '', cantidad: '1' }]) }
    function removeDetalle(i: number) { setDetalles(detalles.filter((_, idx) => idx !== i)) }
    function updateDetalle(i: number, field: string, value: string) {
        const updated = [...detalles]
        updated[i] = { ...updated[i], [field]: value }
        setDetalles(updated)
    }

    // Calcular total del pedido en vivo en el modal (incluyendo descuentos por efectivo)
    const calculateLiveTotal = () => {
        let baseTotal = 0;
        const itemsParaPack: { unidades: number }[] = [];

        detalles.forEach(d => {
            if (!d.presentacionId || !d.cantidad) return;
            const pres = allPresentaciones.find(p => p.id === d.presentacionId);
            if (!pres) return;
            
            const cant = parseInt(d.cantidad);
            baseTotal += pres.precioVenta * cant;
            
            // Agregamos a la lista para calcular packs (asumimos que cada línea es un ítem de un bulto)
            for (let i = 0; i < cant; i++) {
                itemsParaPack.push({ unidades: pres.cantidad });
            }
        });

        if (form.medioPago !== 'efectivo') return baseTotal;

        // Lógica de Descuento por Efectivo:
        // Agrupamos en bultos teóricos de hasta 48 unidades
        let totalDescuento = 0;
        let packsTemp: number[] = [];
        let currentPackUnits = 0;

        // Ordenamos de mayor a menor para optimizar bultos (similar al parser)
        const sortedItems = [...itemsParaPack].sort((a, b) => b.unidades - a.unidades);

        sortedItems.forEach(item => {
            // Un bulto cerrado de 48 o 24 (especial para JYQ) se descuentan directo
            // Para simplificar en el frontend, acumulamos hasta 48
            if (currentPackUnits + item.unidades <= 48) {
                currentPackUnits += item.unidades;
            } else {
                // Cerramos el bulto anterior y evaluamos su descuento
                if (currentPackUnits >= 48) totalDescuento += 2000;
                else if (currentPackUnits >= 24) totalDescuento += 1000;
                
                currentPackUnits = item.unidades;
            }
        });

        // El último bulto
        if (currentPackUnits >= 48) totalDescuento += 2000;
        else if (currentPackUnits >= 24) totalDescuento += 1000;

        return baseTotal - totalDescuento;
    };

    const totalPedido = calculateLiveTotal();

    // Ya no filtramos localmente, la API nos devuelve solo lo que necesitamos
    const filtered = pedidos;

    if (loading && pedidos.length === 0) return <div className="empty-state"><div className="spinner" /><p>Cargando pedidos...</p></div>

    return (
        <div>
            <div className="page-header">
                <h1>📋 Pedidos</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {totalRecords > 0 && (
                        <button className="btn btn-ghost" style={{ color: 'var(--color-danger)' }} onClick={handleLimpiarPedidos}>🧹 Limpiar</button>
                    )}
                    <button className="btn btn-ghost" onClick={() => setShowImportModal(true)}>📂 Importar Excel</button>
                    <button className="btn btn-primary" onClick={() => {
                        setForm({ ...form, fechaEntrega: new Date().toISOString().split('T')[0] });
                        setShowModal(true);
                    }}>+ Nuevo Pedido</button>
                </div>
            </div>

            {/* --- CUADRO DE PROYECCIÓN DE INGRESOS --- */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)', padding: 'var(--space-4)',
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: 'var(--radius-xl)', border: '1px solid #667eea25',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-gray-500)', letterSpacing: '0.5px' }}>Pedidos</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#667eea', fontFamily: 'var(--font-heading)' }}>{stats.totalPedidos}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-gray-500)', letterSpacing: '0.5px' }}>Ingresos Proyectados</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#27AE60', fontFamily: 'var(--font-heading)' }}>${stats.totalImporte.toLocaleString('es-AR')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-gray-500)', letterSpacing: '0.5px' }}>Sándwiches</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#E67E22', fontFamily: 'var(--font-heading)' }}>{stats.totalUnidades.toLocaleString('es-AR')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-gray-500)', letterSpacing: '0.5px' }}>Bultos</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#9B59B6', fontFamily: 'var(--font-heading)' }}>{stats.totalPacks.toLocaleString('es-AR')}</div>
                </div>
            </div>

            {/* --- BARRA FILTROS: Búsqueda + Fecha --- */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '350px' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>🔍</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente..." 
                        className="form-input" 
                        style={{ paddingLeft: '36px' }}
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-gray-500)' }}>📅 Desde:</label>
                    <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                        value={fechaDesde}
                        onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1) }}
                        onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-gray-500)' }}>📅 Hasta:</label>
                    <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
                        value={fechaHasta}
                        onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1) }}
                        onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    />
                </div>
                {(fechaDesde || fechaHasta) && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} onClick={() => { setFechaDesde(''); setFechaHasta(''); setCurrentPage(1) }}>
                        ✕ Limpiar fecha
                    </button>
                )}
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Filtros de Estado */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${filterEstado === '' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => { setFilterEstado(''); setCurrentPage(1) }}>
                    Todos ({totalRecords})
                </button>
                {ESTADOS_PEDIDO.map((est) => (
                    <button key={est.value} className="btn btn-sm" onClick={() => { setFilterEstado(filterEstado === est.value ? '' : est.value); setCurrentPage(1) }}
                        style={{
                            backgroundColor: filterEstado === est.value ? est.color : `${est.color}18`,
                            color: filterEstado === est.value ? '#fff' : est.color,
                            border: `2px solid ${est.color}`, fontWeight: 600,
                        }}>
                        {est.emoji} {est.label}
                    </button>
                ))}
            </div>


            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('cliente')}>Cliente <SortIcon field="cliente" /></th>
                            <th>Fecha Pedido</th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('fechaEntrega')}>Fecha Entrega <SortIcon field="fechaEntrega" /></th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('turno')}>Turno <SortIcon field="turno" /></th>
                            <th>Detalle (Bultos)</th>
                            <th>Packs</th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('totalUnidades')}>Sándwiches <SortIcon field="totalUnidades" /></th>
                            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('totalImporte')}>Importe <SortIcon field="totalImporte" /></th>
                            <th>Pago</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>No hay pedidos</td></tr>
                        ) : filtered.map((ped) => {
                            const est = getEstadoInfo(ped.estado)
                            const nextStates: Record<string, string[]> = {
                                pendiente: ['confirmado', 'rechazado'],
                                confirmado: ['en_ruta', 'rechazado'],
                                en_ruta: ['entregado', 'rechazado'],
                            }
                            const transitions = nextStates[ped.estado] || []
                            return (
                                <tr key={ped.id}>
                                    <td style={{ fontWeight: 600 }}>{ped.cliente.nombreComercial}</td>
                                    <td>{new Date(ped.fechaPedido).toLocaleDateString('es-AR')}</td>
                                    <td>{new Date(ped.fechaEntrega).toLocaleDateString('es-AR')}</td>
                                    <td>
                                        {ped.turno ? (
                                            <span className="badge" style={{
                                                backgroundColor: ped.turno === 'Mañana' ? '#E67E2220' : ped.turno === 'Siesta' ? '#F1C40F20' : '#9B59B620',
                                                color: ped.turno === 'Mañana' ? '#E67E22' : ped.turno === 'Siesta' ? '#F1C40F' : '#9B59B6',
                                                border: `1px solid ${ped.turno === 'Mañana' ? '#E67E2240' : ped.turno === 'Siesta' ? '#F1C40F40' : '#9B59B640'}`,
                                                fontSize: '0.7rem', fontWeight: 700,
                                            }}>
                                                {ped.turno === 'Mañana' ? '🌅' : ped.turno === 'Siesta' ? '☀️' : '🌆'} {ped.turno}
                                            </span>
                                        ) : <span style={{ color: 'var(--color-gray-400)', fontSize: '11px' }}>—</span>}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {/* Agrupamos por nroPack para visualización */}
                                            {Object.entries(
                                                ped.detalles.reduce((acc, d) => {
                                                    const key = d.nroPack ? `Pack ${d.nroPack}` : 'Sin Pack';
                                                    if (!acc[key]) acc[key] = [];
                                                    acc[key].push(d);
                                                    return acc;
                                                }, {} as Record<string, DetallePedido[]>)
                                            ).map(([packTitle, items]) => (
                                                <div key={packTitle} style={{ 
                                                    borderLeft: packTitle === 'Sin Pack' ? '2px solid #eee' : '2px solid var(--color-primary)', 
                                                    paddingLeft: '6px',
                                                    marginBottom: '2px'
                                                }}>
                                                    {items.map((d) => (
                                                        <div key={d.id} style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span className="badge badge-neutral" style={{ fontSize: '9px', padding: '1px 4px' }}>{d.presentacion.producto.codigoInterno}</span>
                                                            <span>x{d.presentacion.cantidad * d.cantidad}</span>
                                                            {d.observaciones && <span style={{ fontStyle: 'italic', color: 'var(--color-primary)', fontSize: '10px' }}>({d.observaciones.toUpperCase()})</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{ped.totalPacks}</td>
                                    <td style={{ fontWeight: 600 }}>{ped.totalUnidades.toLocaleString()}</td>
                                    <td>${ped.totalImporte.toLocaleString('es-AR')}</td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {!ped.abonado ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button onClick={() => toggleMedioPago(ped.id, 'efectivo')}
                                                            title="Cambiar a Efectivo"
                                                            style={{ 
                                                                padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                                backgroundColor: ped.medioPago === 'efectivo' ? '#27AE60' : '#27AE6020',
                                                                color: ped.medioPago === 'efectivo' ? '#fff' : '#27AE60',
                                                                fontSize: '0.65rem', fontWeight: 800, transition: 'all 0.2s'
                                                            }}>
                                                        💵 EF
                                                    </button>
                                                    <button onClick={() => toggleMedioPago(ped.id, 'transferencia')}
                                                            title="Cambiar a Transferencia"
                                                            style={{ 
                                                                padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                                backgroundColor: ped.medioPago === 'transferencia' ? '#3498DB' : '#3498DB20',
                                                                color: ped.medioPago === 'transferencia' ? '#fff' : '#3498DB',
                                                                fontSize: '0.65rem', fontWeight: 800, transition: 'all 0.2s'
                                                            }}>
                                                        🏦 TR
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="badge" style={{
                                                        backgroundColor: ped.medioPago === 'transferencia' ? '#3498DB15' : '#27AE6015',
                                                        color: ped.medioPago === 'transferencia' ? '#2980B9' : '#27AE60',
                                                        border: `1px solid ${ped.medioPago === 'transferencia' ? '#3498DB40' : '#27AE6040'}`,
                                                        fontSize: '0.7rem',
                                                    }}>
                                                        {ped.medioPago === 'transferencia' ? '🏦 Transf.' : '💵 Efectivo'}
                                                    </span>
                                                    <div style={{ marginTop: 'var(--space-1)' }}>
                                                        <span className="badge badge-success" style={{
                                                            fontSize: '0.65rem',
                                                            fontWeight: 800,
                                                            padding: '2px 10px',
                                                            boxShadow: '0 2px 4px rgba(39, 174, 96, 0.2)',
                                                            border: '1px solid #27AE60'
                                                        }}>
                                                            ✅ ABONADO
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ backgroundColor: `${est.color}20`, color: est.color, border: `1px solid ${est.color}40` }}>
                                            {est.emoji} {est.label}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                                            {transitions.map((t) => {
                                                const tInfo = getEstadoInfo(t)
                                                return (
                                                    <button key={t} className="btn btn-ghost btn-sm" style={{ fontSize: '11px', color: tInfo.color }}
                                                        onClick={() => cambiarEstado(ped.id, t)}>
                                                        {tInfo.emoji} {tInfo.label}
                                                    </button>
                                                )
                                            })}
                                            {!ped.abonado && ped.medioPago === 'transferencia' && (
                                                <button className="btn btn-sm" title="Marcar como abonado" 
                                                    style={{ 
                                                        fontSize: '11px', 
                                                        backgroundColor: '#27AE6015',
                                                        color: '#27AE60',
                                                        border: '1.5px solid #27AE60',
                                                        fontWeight: 700,
                                                        padding: '4px 8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.2s ease-in-out'
                                                    }}
                                                    onClick={() => !ped.abonado && marcarAbonado(ped.id)}>
                                                    💰 Abonar
                                                </button>
                                            )}
                                            <button className="btn btn-ghost btn-sm" title="Editar" style={{ fontSize: '11px' }}
                                                onClick={() => startEditPedido(ped)}>✏️</button>
                                            <button className="btn btn-ghost btn-sm" title="Eliminar" style={{ fontSize: '11px', color: 'var(--color-danger)' }}
                                                onClick={() => handleDeletePedido(ped.id)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- PAGINACIÓN --- */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)',
                    marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)',
                }}>
                    <button 
                        className="btn btn-ghost btn-sm" 
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        style={{ fontWeight: 600 }}
                    >
                        ← Anterior
                    </button>
                    
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNum: number
                            if (totalPages <= 7) {
                                pageNum = i + 1
                            } else if (currentPage <= 4) {
                                pageNum = i + 1
                            } else if (currentPage >= totalPages - 3) {
                                pageNum = totalPages - 6 + i
                            } else {
                                pageNum = currentPage - 3 + i
                            }
                            return (
                                <button key={pageNum} className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minWidth: '36px', fontWeight: currentPage === pageNum ? 700 : 400 }}
                                    onClick={() => setCurrentPage(pageNum)}>
                                    {pageNum}
                                </button>
                            )
                        })}
                    </div>

                    <button 
                        className="btn btn-ghost btn-sm" 
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        style={{ fontWeight: 600 }}
                    >
                        Siguiente →
                    </button>
                    
                    <span style={{ fontSize: '12px', color: 'var(--color-gray-500)' }}>
                        {totalRecords} registros
                    </span>
                </div>
            )}

            {/* Modal Nuevo Pedido */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
                        <div className="modal-header">
                            <h2>Nuevo Pedido</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cliente</label>
                                        <select className="form-select" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} required>
                                            <option value="">Seleccionar...</option>
                                            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombreComercial}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha entrega</label>
                                        <input type="date" className="form-input" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} required />
                                    </div>
                                </div>

                                {/* Medio de Pago */}
                                <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
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

                                <div style={{ marginTop: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Productos</label>
                                        <button type="button" className="btn btn-ghost btn-sm" onClick={addDetalle}>+ Agregar línea</button>
                                    </div>
                                    {detalles.map((det, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                            <select className="form-select" value={det.presentacionId} onChange={(e) => updateDetalle(i, 'presentacionId', e.target.value)}>
                                                <option value="">Seleccionar presentación...</option>
                                                {productos.map((p) => (
                                                    <optgroup key={p.id} label={`${p.codigoInterno} — ${p.nombre}`}>
                                                        {p.presentaciones.map((pres) => (
                                                            <option key={pres.id} value={pres.id}>
                                                                x{pres.cantidad} — ${pres.precioVenta.toLocaleString('es-AR')}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            <input type="number" className="form-input" placeholder="Cant." min="1" value={det.cantidad} onChange={(e) => updateDetalle(i, 'cantidad', e.target.value)} />
                                            {detalles.length > 1 && (
                                                <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => removeDetalle(i)}>✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Total en vivo */}
                                {totalPedido > 0 && (
                                    <div style={{
                                        marginTop: 'var(--space-4)', padding: 'var(--space-3)',
                                        backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)',
                                        textAlign: 'right',
                                    }}>
                                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-500)' }}>Total estimado: </span>
                                        <span style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                                            ${totalPedido.toLocaleString('es-AR')}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Crear pedido</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Editar Pedido */}
            {showEditModal && editingPedido && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>✏️ Editar Pedido</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleEditPedido}>
                            <div className="modal-body">
                                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Cliente</div>
                                    <div style={{ fontWeight: 700 }}>{editingPedido.cliente.nombreComercial}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginTop: 4 }}>
                                        {editingPedido.totalUnidades} sándwiches — ${editingPedido.totalImporte.toLocaleString('es-AR')}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha Entrega</label>
                                    <input type="date" className="form-input" value={editForm.fechaEntrega}
                                        onChange={(e) => setEditForm({ ...editForm, fechaEntrega: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Medio de Pago</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setEditForm({ ...editForm, medioPago: 'efectivo' })}
                                            style={{ flex: 1, backgroundColor: editForm.medioPago === 'efectivo' ? '#27AE60' : '#27AE6018', color: editForm.medioPago === 'efectivo' ? '#fff' : '#27AE60', border: '2px solid #27AE60', fontWeight: 600 }}>
                                            💵 Efectivo
                                        </button>
                                        <button type="button" className="btn btn-sm"
                                            onClick={() => setEditForm({ ...editForm, medioPago: 'transferencia' })}
                                            style={{ flex: 1, backgroundColor: editForm.medioPago === 'transferencia' ? '#2980B9' : '#2980B918', color: editForm.medioPago === 'transferencia' ? '#fff' : '#2980B9', border: '2px solid #2980B9', fontWeight: 600 }}>
                                            🏦 Transferencia
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Estado</label>
                                    <select className="form-select" value={editForm.estado}
                                        onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                                        {ESTADOS_PEDIDO.map(est => (
                                            <option key={est.value} value={est.value}>{est.emoji} {est.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal Importar */}
            <ImportarPedidosModal 
                isOpen={showImportModal} 
                onClose={() => setShowImportModal(false)} 
                onSuccess={(msg) => {
                    setSuccess(msg);
                    fetchData();
                    setTimeout(() => setSuccess(''), 4000);
                }}
            />
        </div>
    )
}
