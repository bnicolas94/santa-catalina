'use client'

import { useState, useEffect } from 'react'

interface Producto {
    id: string
    nombre: string
    codigoInterno: string
    planchasPorPaquete: number
    paquetesPorRonda: number
    presentaciones?: { id: string, cantidad: number }[]
}

interface StockProd {
    productoId: string
    presentacionId: string
    nombre: string
    codigoInterno: string
    planchasPorPaquete: number
    cantidadPresentacion: number
    fabrica: number
    local: number
    stockMinimo: number
    ubicaciones?: Record<string, number>
}

interface Ubicacion {
    id: string
    nombre: string
    tipo: string
}

interface Coordinador {
    id: string
    nombre: string
}

interface Lote {
    id: string
    fechaProduccion: string
    horaInicio: string | null
    horaFin: string | null
    unidadesProducidas: number // paquetes
    unidadesRechazadas: number
    motivoRechazo: string | null
    empleadosRonda: number
    estado: string
    producto: Producto
    coordinador: Coordinador | null
    ubicacion: Ubicacion | null
}

const ESTADOS_LOTE = [
    { value: 'en_produccion', label: 'En producción', color: '#F39C12', emoji: '🔧' },
    { value: 'en_camara', label: 'En cámara', color: '#3498DB', emoji: '❄️' },
    { value: 'distribuido', label: 'Distribuido', color: '#2ECC71', emoji: '✅' },
    { value: 'merma', label: 'Merma', color: '#E74C3C', emoji: '⚠️' },
    { value: 'vencido', label: 'Vencido', color: '#95A5A6', emoji: '🕐' },
]

function getEstadoInfo(estado: string) {
    return ESTADOS_LOTE.find((e) => e.value === estado) || { value: estado, label: estado, color: '#607D8B', emoji: '❓' }
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatDateOnly(isoString: string) {
    if (!isoString) return '—'
    // Extraemos la parte de la fecha antes de la 'T' para evitar shifts de zona horaria
    const [year, month, day] = isoString.split('T')[0].split('-')
    return `${day}/${month}/${year}`
}

export default function ProduccionPage() {
    const [lotes, setLotes] = useState<Lote[]>([])
    const [productos, setProductos] = useState<Producto[]>([])
    const [coordinadores, setCoordinadores] = useState<Coordinador[]>([])
    const [movimientos, setMovimientos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showCerrarModal, setShowCerrarModal] = useState(false)
    const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null)
    const [filterEstado, setFilterEstado] = useState('')
    const [filterFecha, setFilterFecha] = useState(getLocalDateString())
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [form, setForm] = useState({
        productoId: '',
        fechaProduccion: getLocalDateString(),
        rondas: '1',
        paquetesPersonales: '',
        empleadosRonda: '1',
        coordinadorId: '',
        estado: 'en_produccion',
        ubicacionId: '',
    })
    const [cerrarForm, setCerrarForm] = useState({
        unidadesRechazadas: '0',
        motivoRechazo: '',
        estado: 'en_camara',
        unidadesProducidas: '',
        empleadosRonda: '',
        fechaProduccion: '',
        coordinadorId: '',
        ubicacionId: '',
        distribucionPresentaciones: [] as { presentacionId: string, cantidad: number }[]
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [stockProductos, setStockProductos] = useState<StockProd[]>([])
    interface PlanningData {
        necesidades: Record<string, Record<string, number>>
        infoProductos: Record<string, Producto>
        manuales: Record<string, Record<string, number>>
        stockFabricacion: Record<string, number>
        enProduccion: Record<string, number>
    }
    const [planning, setPlanning] = useState<PlanningData | null>(null)
    const [activeTurno, setActiveTurno] = useState('Mañana')
    interface UbicacionOption { id: string, nombre: string, tipo: string }
    const [ubicaciones, setUbicaciones] = useState<UbicacionOption[]>([])
    const [showMovModal, setShowMovModal] = useState(false)
    const [movForm, setMovForm] = useState({ productoId: '', presentacionId: '', tipo: 'traslado', cantidad: '', observaciones: '' })
    const [movExtraForm, setMovExtraForm] = useState({ ubicacionId: '', destinoUbicacionId: '' })
    const [showMinStockModal, setShowMinStockModal] = useState(false)
    const [minStockForm, setMinStockForm] = useState({ presentacionId: '', stockMinimo: '' })
    const [showUbiModal, setShowUbiModal] = useState(false)
    const [ubiForm, setUbiForm] = useState({ nombre: '', tipo: 'FABRICA' })
    const [showMermaModal, setShowMermaModal] = useState(false)
    const [mermaForm, setMermaForm] = useState({ productoId: '', presentacionId: '', planchas: '', motivo: '', ubicacionId: '' })

    // Estado para importación Excel
    const [showImportModal, setShowImportModal] = useState(false)
    const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')
    const [importColTurno, setImportColTurno] = useState('')
    const [importColTexto, setImportColTexto] = useState('')
    const [importHeaders, setImportHeaders] = useState<string[]>([])
    const [importRawRows, setImportRawRows] = useState<any[]>([])
    const [importPreview, setImportPreview] = useState<any[]>([])
    const [importSummary, setImportSummary] = useState({ ok: 0, parcial: 0, error: 0 })
    const [importLoading, setImportLoading] = useState(false)

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000) // Poll every 5s for real-time updates
        return () => clearInterval(interval)
    }, [])

    async function fetchData() {
        try {
            const [lotesRes, prodRes, empRes, stockRes, movRes, ubiRes, planRes] = await Promise.all([
                fetch('/api/lotes'),
                fetch('/api/productos'),
                fetch('/api/empleados'),
                fetch('/api/stock-producto'),
                fetch('/api/movimientos-producto?limit=10'),
                fetch('/api/ubicaciones'),
                fetch(`/api/produccion/planificacion?fecha=${filterFecha || getLocalDateString()}`)
            ])
            const lotesData = await lotesRes.json()
            const prodData = await prodRes.json()
            const empData = await empRes.json()
            const stockData = await stockRes.json()
            const movData = await movRes.json()
            const ubiData = await ubiRes.json()
            const planData = await planRes.json()
            setLotes(Array.isArray(lotesData) ? lotesData : [])
            setProductos(Array.isArray(prodData) ? prodData : [])
            setCoordinadores(Array.isArray(empData) ? empData.filter((e: { rol: string; activo: boolean }) => ['ADMIN', 'COORD_PROD'].includes(e.rol) && e.activo) : [])
            setStockProductos(Array.isArray(stockData) ? stockData : [])
            setMovimientos(Array.isArray(movData) ? movData : [])
            setPlanning(planData && !planData.error ? planData : null)
            const validUbi = Array.isArray(ubiData) ? ubiData : []
            setUbicaciones(validUbi)

            // Set default location if none selected
            if (!form.ubicacionId && validUbi.length > 0) {
                const def = validUbi.find(u => u.tipo === 'FABRICA') || validUbi[0]
                setForm(f => ({ ...f, ubicacionId: def.id }))
            }
        } catch {
            setError('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    // Producto seleccionado en el form
    const productoSel = productos.find((p) => p.id === form.productoId)
    const rondasNum = parseInt(form.rondas) || 0
    const paquetesTotal = parseInt(form.paquetesPersonales) || 0
    const planchasTotal = productoSel ? paquetesTotal * productoSel.planchasPorPaquete : 0

    const handleProductoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        const prod = productos.find((p) => p.id === val)
        const paq = prod ? rondasNum * prod.paquetesPorRonda : 0
        setForm({ ...form, productoId: val, paquetesPersonales: val ? String(paq) : '' })
    }

    const handleRondasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const r = e.target.value
        const rNum = parseInt(r) || 0
        const paq = productoSel ? rNum * productoSel.paquetesPorRonda : 0
        setForm({ ...form, rondas: r, paquetesPersonales: String(paq) })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/lotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: form.productoId,
                    fechaProduccion: form.fechaProduccion,
                    unidadesProducidas: paquetesTotal,
                    empleadosRonda: form.empleadosRonda,
                    coordinadorId: form.coordinadorId,
                    estado: form.estado,
                    ubicacionId: form.ubicacionId,
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            setSuccess(`Lote registrado ${form.estado === 'en_produccion' ? '(en producción)' : '(en stock)'} — ${paquetesTotal} paquetes`)
            setShowModal(false)
            setForm({
                productoId: '',
                fechaProduccion: getLocalDateString(),
                rondas: '1',
                paquetesPersonales: '',
                empleadosRonda: '1',
                coordinadorId: '',
                estado: 'en_produccion',
                ubicacionId: ubicaciones.find(u => u.tipo === 'FABRICA')?.id || '',
            })
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    function openCerrarLote(lote: any) {
        setLoteSeleccionado(lote)

        // Cargar distribución previa basándose en los movimientos guardados, o por defecto vacíos.
        const presentaciones = lote.producto.presentaciones || []
        const cantProducidaInicial = lote.unidadesProducidas || 0
        const movimientosPrevios = lote.movimientosProducto || []

        const distribucion = presentaciones.map((pred: any) => {
            const mov = movimientosPrevios.find((m: any) => m.presentacionId === pred.id)
            return {
                presentacionId: pred.id,
                cantidad: mov ? mov.cantidad : (movimientosPrevios.length === 0 && presentaciones[0].id === pred.id ? cantProducidaInicial : 0)
            }
        })

        setCerrarForm({
            unidadesRechazadas: String(lote.unidadesRechazadas),
            motivoRechazo: lote.motivoRechazo || '',
            estado: lote.estado,
            unidadesProducidas: String(lote.unidadesProducidas),
            empleadosRonda: String(lote.empleadosRonda),
            fechaProduccion: lote.fechaProduccion.slice(0, 10),
            coordinadorId: lote.coordinador?.id || '',
            ubicacionId: (lote as any).ubicacionId || '',
            distribucionPresentaciones: distribucion
        })
        setShowCerrarModal(true)
    }

    async function handleCerrarLote(e: React.FormEvent) {
        e.preventDefault()
        if (!loteSeleccionado) return
        setError('')
        try {
            // Verify total distributed equals the reported produced
            const totalDistribucion = cerrarForm.distribucionPresentaciones.reduce((a, b) => a + Number(b.cantidad), 0)
            if (cerrarForm.estado !== 'en_produccion' && loteSeleccionado.estado === 'en_produccion') {
                if (totalDistribucion !== Number(cerrarForm.unidadesProducidas)) {
                    throw new Error(`La suma de paquetes distribuidos (${totalDistribucion}) no coincide con el total producido reportado (${cerrarForm.unidadesProducidas}).`)
                }
            }

            const res = await fetch(`/api/lotes/${loteSeleccionado.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: cerrarForm.estado,
                    unidadesRechazadas: cerrarForm.unidadesRechazadas,
                    motivoRechazo: cerrarForm.motivoRechazo,
                    unidadesProducidas: cerrarForm.unidadesProducidas,
                    empleadosRonda: cerrarForm.empleadosRonda,
                    fechaProduccion: cerrarForm.fechaProduccion,
                    coordinadorId: cerrarForm.coordinadorId,
                    ubicacionId: cerrarForm.ubicacionId,
                    horaFin: cerrarForm.estado !== 'en_camara' ? new Date().toISOString() : null,
                    distribucionPresentaciones: cerrarForm.distribucionPresentaciones
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al actualizar')
            }
            setSuccess('Lote actualizado')
            setShowCerrarModal(false)
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleDeleteLote(lote: Lote) {
        if (!confirm(`¿Seguro que querés eliminar el lote ${lote.id}?\n\nSe revertirá el stock de insumos consumidos y el stock de producto terminado generado.`)) return
        setError('')
        try {
            const res = await fetch(`/api/lotes/${lote.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar')
            }
            setSuccess(`Lote ${lote.id} eliminado y stock revertido`)
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleMovSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        try {
            const res = await fetch('/api/movimientos-producto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...movForm,
                    ubicacionId: movExtraForm.ubicacionId,
                    destinoUbicacionId: movExtraForm.destinoUbicacionId
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
            }
            const data = await res.json()
            setSuccess(data.mensaje || 'Movimiento registrado')
            setShowMovModal(false)
            setMovForm({ productoId: '', presentacionId: '', tipo: 'traslado', cantidad: '', observaciones: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    const lotesPorFecha = filterFecha ? lotes.filter((l) => {
        const lDateStr = l.fechaProduccion.split('T')[0]
        return lDateStr === filterFecha
    }) : lotes
    const filteredLotes = filterEstado ? lotesPorFecha.filter((l) => l.estado === filterEstado) : lotesPorFecha

    const stats = {
        total: lotesPorFecha.length,
        enCamara: lotesPorFecha.filter((l) => l.estado === 'en_camara').length,
        distribuido: lotesPorFecha.filter((l) => l.estado === 'distribuido').length,
        merma: lotesPorFecha.filter((l) => l.estado === 'merma').length,
        totalPaquetes: lotesPorFecha.reduce((acc, l) => acc + l.unidadesProducidas, 0),
    }

    const enProcesoPorProducto = lotes
        .filter(l => l.estado === 'en_produccion')
        .reduce((acc, l) => {
            acc[l.producto.id] = (acc[l.producto.id] || 0) + l.unidadesProducidas
            return acc
        }, {} as Record<string, number>)

    async function handleMinStockSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await fetch(`/api/presentaciones/${minStockForm.presentacionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stockMinimo: minStockForm.stockMinimo }),
            })
            if (!res.ok) throw new Error('Error al actualizar stock mínimo')
            setSuccess('Stock mínimo actualizado correctamente')
            setShowMinStockModal(false)
            fetchData()
        } catch (err: any) {
            setError(err.message)
        }
    }

    // Merma por planchas
    const mermaProducto = productos.find(p => p.id === mermaForm.productoId)
    const planchasPorPaq = mermaProducto?.planchasPorPaquete || 6
    const planchasNum = parseFloat(mermaForm.planchas) || 0
    const paquetesMerma = planchasNum / planchasPorPaq

    async function handleMermaSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (paquetesMerma <= 0) { setError('Debe ingresar al menos 1 plancha'); return }
        try {
            const res = await fetch('/api/movimientos-producto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productoId: mermaForm.productoId,
                    presentacionId: mermaForm.presentacionId,
                    tipo: 'merma',
                    cantidad: Math.ceil(paquetesMerma),
                    observaciones: `Merma ${planchasNum} planchas — ${mermaForm.motivo || 'Sin motivo'}`,
                    ubicacionId: mermaForm.ubicacionId,
                }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(`Merma registrada: ${planchasNum} planchas (${Math.ceil(paquetesMerma)} paq) descontadas`)
            setShowMermaModal(false)
            setMermaForm({ productoId: '', presentacionId: '', planchas: '', motivo: '', ubicacionId: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 4000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleManualChange(productoId: string, cantidad: string) {
        try {
            const res = await fetch('/api/produccion/planificacion/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: filterFecha || getLocalDateString(),
                    turno: activeTurno,
                    productoId,
                    cantidad
                })
            })
            if (!res.ok) throw new Error('Error al guardar')
            fetchData() // Actualizar vista
        } catch (err: any) {
            setError(err.message)
        }
    }

    async function handleExcelFile(file: File) {
        try {
            const XLSX = await import('xlsx')
            const buffer = await file.arrayBuffer()
            const wb = XLSX.read(buffer, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
            if (!rows.length) { setError('El archivo está vacío.'); return }
            const headers = Object.keys(rows[0])
            setImportHeaders(headers)
            setImportRawRows(rows)
            // Auto-detectar columnas
            const turnoCol = headers.find(h => /turno/i.test(h)) || ''
            const textoCol = headers.find(h => /neces|pedido|prod|item|detalle/i.test(h)) || ''
            setImportColTurno(turnoCol)
            setImportColTexto(textoCol)
        } catch (err: any) {
            setError('Error al leer el archivo: ' + err.message)
        }
    }

    async function handleImportPreview() {
        if (!importColTurno || !importColTexto) { setError('Seleccioná las columnas de Turno y Necesidades.'); return }
        setImportLoading(true)
        try {
            const filas = importRawRows.map(r => ({ turno: String(r[importColTurno] || ''), texto: String(r[importColTexto] || '') }))
            const res = await fetch('/api/produccion/planificacion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: filterFecha || getLocalDateString(), filas, confirmar: false })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setImportPreview(data.resultados)
            setImportSummary({ ok: data.ok, parcial: data.parcial, error: data.error })
            setImportStep('preview')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setImportLoading(false)
        }
    }

    async function handleImportConfirm() {
        setImportLoading(true)
        try {
            const filas = importRawRows.map(r => ({ turno: String(r[importColTurno] || ''), texto: String(r[importColTexto] || '') }))
            const res = await fetch('/api/produccion/planificacion/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: filterFecha || getLocalDateString(), filas, confirmar: true })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setImportStep('done')
            setSuccess(`¡Importación exitosa! ${data.guardados} requerimientos cargados.`)
            fetchData()
            setTimeout(() => { setShowImportModal(false); setImportStep('upload'); setSuccess('') }, 3000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setImportLoading(false)
        }
    }

    if (loading) return <div className="loading-container"><div className="loader"></div><p>Cargando producción...</p></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>🏭 Producción — Lotes</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input
                        type="date"
                        className="form-input"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        title="Filtrar por fecha"
                        style={{ height: '38px' }}
                    />
                    {filterFecha && (
                        <button className="btn btn-ghost" onClick={() => setFilterFecha('')} title="Ver todas las fechas" style={{ padding: '0 8px', fontSize: '1.2rem' }}>
                            ✕
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => {
                        setForm(f => ({ ...f, fechaProduccion: filterFecha || new Date().toISOString().slice(0, 10) }))
                        setShowModal(true)
                    }}>+ Nuevo Lote</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Planificación por Turnos */}
            {planning && (
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>📅 Planificación — {formatDateOnly(filterFecha || getLocalDateString())}</h2>
                                <span className="badge badge-info" style={{ fontSize: '10px' }}>Basado en Hoja de Ruta</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                    className="btn btn-xs btn-ghost"
                                    style={{ fontSize: '11px', padding: '4px 10px', border: '1px dashed var(--color-gray-300)' }}
                                    onClick={() => { setImportStep('upload'); setImportHeaders([]); setImportRawRows([]); setShowImportModal(true) }}
                                >
                                    📥 Importar Excel
                                </button>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                                    {['Mañana', 'Siesta', 'Tarde', 'Por Asignar'].map(t => (
                                        <button 
                                            key={t}
                                            className={`btn btn-xs ${activeTurno === t ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setActiveTurno(t)}
                                            style={{ fontSize: '11px', padding: '4px 12px' }}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="table-container" style={{ margin: 0, border: '1px solid var(--color-gray-100)' }}>
                            <table className="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th style={{ textAlign: 'center' }}>H. Ruta</th>
                                        <th style={{ textAlign: 'center' }}>Carga Express</th>
                                        <th style={{ textAlign: 'center' }}>Stock Fab.</th>
                                        <th style={{ textAlign: 'center' }}>En Proceso</th>
                                        <th style={{ textAlign: 'center' }}>Total Faltante</th>
                                        <th style={{ textAlign: 'right' }}>Sugerencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(planning.necesidades[activeTurno] || {}).length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--space-4)' }}>
                                                No hay requerimientos para el turno {activeTurno}
                                            </td>
                                        </tr>
                                    ) : (
                                        Object.entries(planning.necesidades[activeTurno]).map(([pid, totalReq]) => {
                                            const prod = planning.infoProductos[pid]
                                            const manualQty = planning.manuales[activeTurno]?.[pid] || 0
                                            const rutaQty = totalReq - manualQty
                                            const stock = planning.stockFabricacion[pid] || 0
                                            const enProc = planning.enProduccion[pid] || 0
                                            const faltante = Math.max(0, totalReq - stock - enProc)
                                            const rondasSugeridas = Math.ceil(faltante / (prod?.paquetesPorRonda || 14))

                                            return (
                                                <tr key={pid}>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{prod?.nombre}</div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>{prod?.codigoInterno}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-gray-500)' }}>{rutaQty > 0 ? `${rutaQty} paq` : '—'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input 
                                                            type="number" 
                                                            className="form-input" 
                                                            style={{ width: '60px', height: '28px', textAlign: 'center', fontSize: '12px', padding: '0' }}
                                                            value={manualQty || ''} 
                                                            placeholder="0"
                                                            onChange={(e) => handleManualChange(pid, e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'center', color: stock < totalReq ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '12px' }}>
                                                        {stock} paq
                                                    </td>
                                                    <td style={{ textAlign: 'center', color: '#F39C12', fontSize: '12px' }}>
                                                        {enProc > 0 ? `${enProc} paq` : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {faltante > 0 ? (
                                                            <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '13px' }}>{faltante} paq</span>
                                                        ) : (
                                                            <span style={{ color: 'var(--color-success)', fontSize: '12px' }}>Cubierto ✅</span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {faltante > 0 ? (
                                                            <button 
                                                                className="btn btn-xs btn-primary"
                                                                onClick={() => {
                                                                    setForm({
                                                                        ...form,
                                                                        productoId: pid,
                                                                        rondas: String(rondasSugeridas),
                                                                        paquetesPersonales: String(rondasSugeridas * (prod?.paquetesPorRonda || 14)),
                                                                        fechaProduccion: filterFecha || getLocalDateString()
                                                                    })
                                                                    setShowModal(true)
                                                                }}
                                                            >
                                                                Producir {rondasSugeridas} rondas
                                                            </button>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                    {/* Fila para agregar producto extra al turno */}
                                    <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                        <td colSpan={2}>
                                            <select 
                                                className="form-select" 
                                                style={{ height: '32px', fontSize: '12px' }}
                                                onChange={(e) => {
                                                    if(e.target.value) handleManualChange(e.target.value, '1')
                                                    e.target.value = ''
                                                }}
                                            >
                                                <option value="">+ Agregar producto extra al turno {activeTurno}...</option>
                                                {productos
                                                    .filter(p => !planning.necesidades[activeTurno]?.[p.id])
                                                    .map(p => <option key={p.id} value={p.id}>[{p.codigoInterno}] {p.nombre}</option>)
                                                }
                                            </select>
                                        </td>
                                        <td colSpan={5}></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Producto Terminado */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', overflow: 'visible' }}>
                <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>📦 Stock Producto Terminado</h2>
                            <div className="pulse-live" title="Actualizando en tiempo real cada 5s" />
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowUbiModal(true)} title="Configurar Fábricas y Locales">⚙️ Sedes</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setShowMovModal(true)}>Mover Stock</button>
                            <button className="btn btn-sm" style={{ backgroundColor: '#E74C3C', color: '#fff', fontWeight: 600 }} onClick={() => {
                                const fab = ubicaciones.find(u => u.tipo === 'FABRICA')
                                setMermaForm(f => ({ ...f, ubicacionId: fab?.id || '' }))
                                setShowMermaModal(true)
                            }}>⚠️ Merma</button>
                        </div>
                    </div>
                    {stockProductos.length === 0 ? (
                        <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: 'var(--space-4)' }}>No hay stock registrado. Registrá un lote para empezar.</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                            {stockProductos.map(sp => {
                                const total = sp.fabrica + sp.local
                                const isLowStock = sp.fabrica < sp.stockMinimo

                                return (
                                    <div key={`${sp.productoId}_${sp.presentacionId}`} style={{
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        border: isLowStock ? '2px solid #E74C3C' : '1px solid var(--color-gray-200)',
                                        backgroundColor: isLowStock ? '#FFF5F5' : 'var(--color-gray-50)',
                                        boxShadow: isLowStock ? '0 0 10px rgba(231, 76, 60, 0.2)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="badge badge-neutral" style={{ fontWeight: 700 }}>{sp.codigoInterno}</span>
                                                {isLowStock && <span title="¡Stock bajo en fábrica!" style={{ cursor: 'help' }}>⚠️</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontWeight: 600 }}>[x{sp.cantidadPresentacion}] {sp.nombre}</span>
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    style={{ padding: '2px', height: 'auto', minHeight: '0' }}
                                                    onClick={() => {
                                                        setMinStockForm({ presentacionId: sp.presentacionId, stockMinimo: String(sp.stockMinimo) })
                                                        setShowMinStockModal(true)
                                                    }}
                                                    title="Configurar stock mínimo"
                                                >
                                                    ⚙️
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {Object.entries(sp.ubicaciones || {})
                                                .sort(([nameA], [nameB]) => {
                                                    const ubiA = ubicaciones.find(x => x.nombre === nameA)
                                                    const ubiB = ubicaciones.find(x => x.nombre === nameB)
                                                    if (ubiA?.tipo === 'FABRICA' && ubiB?.tipo !== 'FABRICA') return -1
                                                    if (ubiA?.tipo !== 'FABRICA' && ubiB?.tipo === 'FABRICA') return 1
                                                    return nameA.localeCompare(nameB)
                                                })
                                                .map(([ubiName, qty]) => {
                                                    const ubi = ubicaciones.find(x => x.nombre === ubiName)
                                                    const isFab = ubi?.tipo === 'FABRICA'
                                                    const color = isFab ? (isLowStock ? '#E74C3C' : '#2ECC71') : '#3498DB'

                                                    return (
                                                        <div key={ubiName}
                                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'var(--white)', border: '1px solid var(--color-gray-100)', borderRadius: '4px', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                setMovForm({ productoId: sp.productoId, presentacionId: sp.presentacionId, tipo: 'ajuste', cantidad: String(qty), observaciones: '' })
                                                                setMovExtraForm({ ubicacionId: ubi?.id || '', destinoUbicacionId: '' })
                                                                setShowMovModal(true)
                                                            }}
                                                            title={`Ajustar stock en ${ubiName}`}
                                                        >
                                                            <span style={{ fontSize: '10px', color: 'var(--color-gray-500)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                                                {isFab ? '🏭' : '🏪'} {ubiName}
                                                            </span>
                                                            <span style={{ fontWeight: 700, color: color, fontSize: '14px' }}>
                                                                {qty} <span style={{ fontSize: '10px', opacity: 0.5 }}>✏️</span>
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            {Object.keys(sp.ubicaciones || {}).length === 0 && (
                                                <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textAlign: 'center', fontStyle: 'italic' }}>Sin stock registrado</div>
                                            )}
                                        </div>
                                        {enProcesoPorProducto[sp.productoId] > 0 && (
                                            <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px dashed var(--color-gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', color: '#F39C12', textTransform: 'uppercase', fontWeight: 700 }}>🚧 En camino:</span>
                                                <span style={{ fontSize: 'var(--text-sm)', color: '#F39C12', fontWeight: 700 }}>{enProcesoPorProducto[sp.productoId]} paq.</span>
                                            </div>
                                        )}
                                        {sp.stockMinimo > 0 && (
                                            <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px', color: isLowStock ? '#E74C3C' : 'var(--color-gray-400)', textTransform: 'uppercase', fontWeight: 600 }}>
                                                Mínimo: {sp.stockMinimo} paq.
                                            </div>
                                        )}
                                        <div style={{ marginTop: 'var(--space-3)' }}>
                                            <button className="btn btn-sm btn-ghost" style={{ width: '100%', fontSize: '10px', height: '24px' }}
                                                onClick={() => {
                                                    const fab = ubicaciones.find(u => u.tipo === 'FABRICA')
                                                    const loc = ubicaciones.find(u => u.tipo === 'LOCAL')
                                                    setMovForm({ productoId: sp.productoId, presentacionId: sp.presentacionId, tipo: 'traslado', cantidad: '', observaciones: '' })
                                                    setMovExtraForm({ ubicacionId: fab?.id || '', destinoUbicacionId: loc?.id || '' })
                                                    setShowMovModal(true)
                                                }}>
                                                🚚 Traslado rápido
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                <div className="card" style={{ cursor: 'pointer', border: filterEstado === '' ? '2px solid var(--color-primary)' : undefined }} onClick={() => setFilterEstado('')}>
                    <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)' }}>{stats.totalPaquetes.toLocaleString()}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Paquetes producidos</div>
                    </div>
                </div>
                {ESTADOS_LOTE.slice(0, 3).map((est) => {
                    const count = lotesPorFecha.filter((l) => l.estado === est.value).length
                    return (
                        <div key={est.value} className="card" style={{ cursor: 'pointer', border: filterEstado === est.value ? `2px solid ${est.color}` : undefined }} onClick={() => setFilterEstado(filterEstado === est.value ? '' : est.value)}>
                            <div className="card-body" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: est.color }}>{count}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>{est.emoji} {est.label}</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="grouped-lotes-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {(() => {
                    const grouped = filteredLotes.reduce((acc, lote) => {
                        const pid = lote.producto.id
                        if (!acc[pid]) {
                            acc[pid] = {
                                producto: lote.producto,
                                lotes: [],
                                totalPaquetes: 0,
                                totalPlanchas: 0,
                                totalRechazados: 0
                            }
                        }
                        acc[pid].lotes.push(lote)
                        acc[pid].totalPaquetes += lote.unidadesProducidas
                        acc[pid].totalPlanchas += (lote.unidadesProducidas * (lote.producto.planchasPorPaquete || 6))
                        acc[pid].totalRechazados += lote.unidadesRechazadas
                        return acc
                    }, {} as Record<string, { producto: Producto, lotes: Lote[], totalPaquetes: number, totalPlanchas: number, totalRechazados: number }>)

                    const sortedGroups = Object.values(grouped).sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre))

                    if (sortedGroups.length === 0) {
                        return (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📋</div>
                                <p>No hay lotes registrados para los filtros seleccionados.</p>
                            </div>
                        )
                    }

                    return sortedGroups.map((group) => {
                        const isExpanded = !!expandedGroups[group.producto.id]
                        return (
                            <div key={group.producto.id} className="card" style={{ border: '1px solid var(--color-gray-200)', overflow: 'hidden' }}>
                                <div
                                    className="card-header"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 'var(--space-3) var(--space-4)',
                                        cursor: 'pointer',
                                        backgroundColor: isExpanded ? 'var(--color-gray-50)' : 'white',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onClick={() => setExpandedGroups(prev => ({ ...prev, [group.producto.id]: !prev[group.producto.id] }))}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '📂' : '📁'}</span>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>
                                                <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{group.producto.codigoInterno}</span>
                                                {group.producto.nombre}
                                            </h3>
                                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{group.lotes.length} lote{group.lotes.length !== 1 ? 's' : ''} registrado{group.lotes.length !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>{group.totalPaquetes.toLocaleString()} paq</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Total Paquetes</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-gray-600)' }}>{group.totalPlanchas.toLocaleString()} pl</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Total Planchas</div>
                                        </div>
                                        {group.totalRechazados > 0 && (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-danger)' }}>{group.totalRechazados}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--color-gray-400)', textTransform: 'uppercase' }}>Rechazados</div>
                                            </div>
                                        )}
                                        <div style={{ fontSize: '1.2rem', marginLeft: 'var(--space-2)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                            ⌄
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="card-body" style={{ padding: 0, borderTop: '1px solid var(--color-gray-100)' }}>
                                        <div className="table-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                                            <table className="table table-sm">
                                                <thead>
                                                    <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                                        <th>Lote ID</th>
                                                        <th>Fecha</th>
                                                        <th>Paquetes</th>
                                                        <th>Planchas</th>
                                                        <th>Rechazos</th>
                                                        <th>Ubicación</th>
                                                        <th>Coordinador</th>
                                                        <th>Estado</th>
                                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.lotes.map((lote) => {
                                                        const est = getEstadoInfo(lote.estado)
                                                        const mermaPercent = lote.unidadesProducidas > 0 ? ((lote.unidadesRechazadas / lote.unidadesProducidas) * 100).toFixed(1) : '0'
                                                        const planchas = lote.unidadesProducidas * (lote.producto.planchasPorPaquete || 6)
                                                        return (
                                                            <tr key={lote.id}>
                                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11px' }}>{lote.id}</td>
                                                                <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateOnly(lote.fechaProduccion)}</td>
                                                                <td style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{lote.unidadesProducidas.toLocaleString()} paq</td>
                                                                <td style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)' }}>{planchas.toLocaleString()} pl</td>
                                                                <td style={{ fontSize: 'var(--text-xs)' }}>
                                                                    {lote.unidadesRechazadas > 0 ? (
                                                                        <span style={{ color: parseFloat(mermaPercent) > 5 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                                                            {lote.unidadesRechazadas} ({mermaPercent}%)
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td><span style={{ fontSize: '10px', fontWeight: 600 }}>{lote.ubicacion?.nombre || '—'}</span></td>
                                                                <td style={{ fontSize: 'var(--text-xs)' }}>{lote.coordinador?.nombre || '—'}</td>
                                                                <td>
                                                                    <span className="badge" style={{ backgroundColor: `${est.color}15`, color: est.color, border: `1px solid ${est.color}30`, fontSize: '10px', padding: '2px 6px' }}>
                                                                        {est.emoji} {est.label}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                                                                        <button className="btn btn-icon btn-xs btn-ghost" style={{ color: 'var(--color-primary)' }} onClick={(e) => { e.stopPropagation(); openCerrarLote(lote) }}>✏️</button>
                                                                        <button className="btn btn-icon btn-xs btn-ghost" style={{ color: '#E74C3C' }} onClick={(e) => { e.stopPropagation(); handleDeleteLote(lote) }}>🗑️</button>
                                                                    </div>
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
                    })
                })()}
            </div>

            {/* Modal Nuevo Lote */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Registrar Nuevo Lote</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Producto</label>
                                    <select className="form-select" value={form.productoId} onChange={handleProductoChange} required>
                                        <option value="">Seleccionar producto...</option>
                                        {productos.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.codigoInterno}] {p.nombre} — {p.paquetesPorRonda} paq/ronda, {p.planchasPorPaquete} pl/paq
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha de producción</label>
                                        <input type="date" className="form-input" value={form.fechaProduccion} onChange={(e) => setForm({ ...form, fechaProduccion: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad de rondas</label>
                                        <input type="number" className="form-input" value={form.rondas} onChange={handleRondasChange} required placeholder="1" min="1" />
                                    </div>
                                </div>

                                {/* Resumen calculado */}
                                {productoSel && rondasNum > 0 && (
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)',
                                        padding: 'var(--space-4)', backgroundColor: 'var(--color-gray-50)',
                                        borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)', marginBottom: 'var(--space-4)',
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{rondasNum}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Ronda{rondasNum > 1 ? 's' : ''}</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                value={form.paquetesPersonales}
                                                onChange={(e) => setForm({ ...form, paquetesPersonales: e.target.value })}
                                                style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)', textAlign: 'center', width: '100px', background: 'transparent', borderBottom: '2px dashed var(--color-gray-300)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: 0 }}
                                                min="1"
                                                title="Puedes editar los paquetes manualmente si la ronda tuvo una cantidad extra"
                                            />
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', marginTop: '4px' }}>Paquetes</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>{planchasTotal}</div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', fontFamily: 'var(--font-ui)', textTransform: 'uppercase' }}>Planchas</div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Sede / Ubicación</label>
                                        <select className="form-select" value={form.ubicacionId} onChange={(e) => setForm({ ...form, ubicacionId: e.target.value })} required>
                                            <option value="">Seleccionar sede...</option>
                                            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Coordinador</label>
                                        <select className="form-select" value={form.coordinadorId} onChange={(e) => setForm({ ...form, coordinadorId: e.target.value })}>
                                            <option value="">Sin asignar</option>
                                            {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Estado inicial */}
                                <div className="form-group">
                                    <label className="form-label">Estado inicial del lote</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button type="button" className="btn btn-sm" style={{ flex: 1, backgroundColor: form.estado === 'en_produccion' ? '#F39C12' : '#F39C1218', color: form.estado === 'en_produccion' ? '#fff' : '#F39C12', border: '2px solid #F39C12', fontWeight: 600 }}
                                            onClick={() => setForm({ ...form, estado: 'en_produccion' })}>
                                            🔧 En producción (no suma al stock aún)
                                        </button>
                                        <button type="button" className="btn btn-sm" style={{ flex: 1, backgroundColor: form.estado === 'en_camara' ? '#3498DB' : '#3498DB18', color: form.estado === 'en_camara' ? '#fff' : '#3498DB', border: '2px solid #3498DB', fontWeight: 600 }}
                                            onClick={() => setForm({ ...form, estado: 'en_camara' })}>
                                            ❄️ Ya terminado (suma al stock)
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Registrar lote</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Modal Editar Lote */}
            {showCerrarModal && loteSeleccionado && (
                <div className="modal-overlay" onClick={() => setShowCerrarModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>✏️ Editar Lote {loteSeleccionado.id}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowCerrarModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCerrarLote}>
                            <div className="modal-body">
                                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                                    <strong>{loteSeleccionado.producto.nombre}</strong> ({loteSeleccionado.producto.codigoInterno})
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Fecha producción</label>
                                        <input type="date" className="form-input" value={cerrarForm.fechaProduccion} onChange={(e) => setCerrarForm({ ...cerrarForm, fechaProduccion: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Estado del lote</label>
                                        <select className="form-select" value={cerrarForm.estado} onChange={(e) => setCerrarForm({ ...cerrarForm, estado: e.target.value })}>
                                            {ESTADOS_LOTE.map((e) => <option key={e.value} value={e.value}>{e.emoji} {e.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Paquetes producidos</label>
                                        <input type="number" className="form-input" value={cerrarForm.unidadesProducidas} onChange={(e) => setCerrarForm({ ...cerrarForm, unidadesProducidas: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Operarios en ronda</label>
                                        <input type="number" className="form-input" value={cerrarForm.empleadosRonda} onChange={(e) => setCerrarForm({ ...cerrarForm, empleadosRonda: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Sede / Ubicación</label>
                                        <select className="form-select" value={cerrarForm.ubicacionId} onChange={(e) => setCerrarForm({ ...cerrarForm, ubicacionId: e.target.value })} required>
                                            <option value="">Seleccionar sede...</option>
                                            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Coordinador</label>
                                        <select className="form-select" value={cerrarForm.coordinadorId} onChange={(e) => setCerrarForm({ ...cerrarForm, coordinadorId: e.target.value })}>
                                            <option value="">Sin asignar</option>
                                            {coordinadores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Paquetes rechazados</label>
                                        <input type="number" className="form-input" value={cerrarForm.unidadesRechazadas} onChange={(e) => setCerrarForm({ ...cerrarForm, unidadesRechazadas: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo rechazo</label>
                                        <input className="form-input" value={cerrarForm.motivoRechazo} onChange={(e) => setCerrarForm({ ...cerrarForm, motivoRechazo: e.target.value })} placeholder="Opcional" />
                                    </div>
                                </div>

                                {loteSeleccionado?.producto?.presentaciones && loteSeleccionado.producto.presentaciones.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)' }}>
                                        <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--text-md)', fontFamily: 'var(--font-heading)' }}>Distribución por Presentación</h4>
                                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', marginBottom: 'var(--space-3)' }}>
                                            Si cambias el estado a terminado o distribuyes stock, indica cuántos paquetes de cada tamaño armaste.
                                            El total debe sumar <strong>{cerrarForm.unidadesProducidas || 0}</strong> paquetes.
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {loteSeleccionado.producto.presentaciones.map((p, index) => {
                                                const dist = cerrarForm.distribucionPresentaciones.find(d => d.presentacionId === p.id)
                                                return (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                        <span style={{ minWidth: '80px', fontWeight: 600 }}>x{p.cantidad}</span>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            min="0"
                                                            value={dist?.cantidad || ''}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0
                                                                const newDist = [...cerrarForm.distribucionPresentaciones]
                                                                const distIdx = newDist.findIndex(x => x.presentacionId === p.id)
                                                                if (distIdx >= 0) {
                                                                    newDist[distIdx].cantidad = val
                                                                } else {
                                                                    newDist.push({ presentacionId: p.id, cantidad: val })
                                                                }
                                                                setCerrarForm({ ...cerrarForm, distribucionPresentaciones: newDist })
                                                            }}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCerrarModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )
            }

            {/* Modal Mover Stock */}
            {showMovModal && (
                <div className="modal-overlay" onClick={() => setShowMovModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ margin: 0 }}>📦 Mover / Ajustar Stock</h2>
                            <button className="btn btn-ghost" onClick={() => setShowMovModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleMovSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Tipo de movimiento</label>
                                    <select
                                        className="form-input"
                                        value={movForm.tipo}
                                        onChange={e => setMovForm({ ...movForm, tipo: e.target.value })}
                                    >
                                        <option value="traslado">Traslado entre puntos</option>
                                        <option value="reparto">Reparto / Venta externa</option>
                                        <option value="venta_local">Venta en Local</option>
                                        <option value="merma">Merma / Vencimiento</option>
                                        <option value="ajuste">Ajuste Manual</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">
                                            {movForm.tipo === 'traslado' ? 'Origen' : 'Ubicación'}
                                        </label>
                                        <select
                                            className="form-input"
                                            value={movExtraForm.ubicacionId}
                                            onChange={e => setMovExtraForm({ ...movExtraForm, ubicacionId: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccionar...</option>
                                            {ubicaciones.map(u => (
                                                <option key={u.id} value={u.id}>{u.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {movForm.tipo === 'traslado' && (
                                        <div className="form-group">
                                            <label className="form-label">Destino</label>
                                            <select
                                                className="form-input"
                                                value={movExtraForm.destinoUbicacionId}
                                                onChange={e => setMovExtraForm({ ...movExtraForm, destinoUbicacionId: e.target.value })}
                                                required
                                            >
                                                <option value="">Seleccionar...</option>
                                                {ubicaciones.map(u => (
                                                    <option key={u.id} value={u.id}>{u.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Producto y Presentación</label>
                                    <select
                                        className="form-input"
                                        value={`${movForm.productoId}_${movForm.presentacionId}`}
                                        onChange={e => {
                                            const [pId, prId] = e.target.value.split('_')
                                            setMovForm({ ...movForm, productoId: pId || '', presentacionId: prId || '' })
                                        }}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {productos.flatMap(p =>
                                            (p.presentaciones || []).map(pr => (
                                                <option key={`${p.id}_${pr.id}`} value={`${p.id}_${pr.id}`}>
                                                    [{pr.cantidad === 48 ? 'x48' : pr.cantidad === 24 ? 'x24' : `x${pr.cantidad}`}] {p.nombre}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">
                                            {movForm.tipo.startsWith('ajuste') ? 'Nuevo Stock Total' : 'Cantidad de paquetes'}
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={movForm.cantidad}
                                            onChange={e => setMovForm({ ...movForm, cantidad: e.target.value })}
                                            placeholder={movForm.tipo.startsWith('ajuste') ? 'Ej: 15' : 'Ej: 5'}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Observaciones</label>
                                        <input
                                            className="form-input"
                                            value={movForm.observaciones}
                                            onChange={(e) => setMovForm({ ...movForm, observaciones: e.target.value })}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>

                                {movForm.tipo.startsWith('ajuste') && (
                                    <div style={{ padding: 'var(--space-3)', backgroundColor: '#FFF9E6', border: '1px solid #FFE58F', borderRadius: 'var(--radius-md)', fontSize: '13px', color: '#856404' }}>
                                        ⚠️ <strong>Ajuste excepcional:</strong> Ingresá el total real que hay físicamente. El sistema calculará la diferencia y creará un registro de "ajuste" para trazabilidad.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowMovModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Stock Mínimo */}
            {showMinStockModal && (
                <div className="modal-overlay" onClick={() => setShowMinStockModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2 style={{ margin: 0 }}>⚙️ Configurar Alerta</h2>
                            <button className="btn btn-ghost" onClick={() => setShowMinStockModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleMinStockSubmit}>
                            <div className="modal-body">
                                <p style={{ fontSize: '14px', marginBottom: 'var(--space-4)' }}>
                                    Definí el stock mínimo en <strong>Fábrica</strong> para recibir una alerta visual cuando los paquetes disponibles bajen de este nivel.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Stock Mínimo (paquetes)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={minStockForm.stockMinimo}
                                        onChange={e => setMinStockForm({ ...minStockForm, stockMinimo: e.target.value })}
                                        placeholder="Ej: 10"
                                        required
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowMinStockModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar configuración</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Historial Reciente */}
            <div className="card" style={{ marginTop: 'var(--space-8)', border: 'none', boxShadow: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h2 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>🕒 Historial Reciente de Movimientos</h2>
                </div>
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="table table-compact">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Producto</th>
                                <th>Tipo</th>
                                <th>Cant.</th>
                                <th>Ubicación</th>
                                <th>Obs.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movimientos.slice(0, 15).map(m => (
                                <tr key={m.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                    <td>
                                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{m.producto.nombre}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>{m.producto.codigoInterno}</div>
                                    </td>
                                    <td>
                                        <span className="badge" style={{
                                            backgroundColor: m.tipo === 'traslado' ? '#3498DB20' : m.tipo === 'produccion' ? '#2ECC7120' : '#E67E2220',
                                            color: m.tipo === 'traslado' ? '#3498DB' : m.tipo === 'produccion' ? '#27AE60' : '#D35400',
                                            fontSize: '10px',
                                            textTransform: 'uppercase'
                                        }}>
                                            {m.tipo === 'venta_local' ? 'Venta' : m.tipo}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 700, color: m.signo === 'entrada' ? '#27AE60' : '#E74C3C' }}>
                                        {m.signo === 'entrada' ? '+' : '-'}{m.cantidad}
                                    </td>
                                    <td style={{ fontSize: '11px', textTransform: 'capitalize' }}>{m.ubicacion?.nombre || '—'}</td>
                                    <td style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>{m.observaciones}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal Gestión de Ubicaciones */}
            {showUbiModal && (
                <div className="modal-overlay" onClick={() => setShowUbiModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 style={{ margin: 0 }}>📍 Gestionar Sedes (Fábricas/Locales)</h2>
                            <button className="btn btn-ghost" onClick={() => setShowUbiModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault()
                                try {
                                    const res = await fetch('/api/ubicaciones', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(ubiForm)
                                    })
                                    if (!res.ok) throw new Error('Error al guardar')
                                    setUbiForm({ nombre: '', tipo: 'FABRICA' })
                                    fetchData()
                                } catch (err: any) { setError(err.message) }
                            }} style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end', background: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Nombre (ej: Villa Elisa)</label>
                                    <input className="form-input" value={ubiForm.nombre} onChange={e => setUbiForm({ ...ubiForm, nombre: e.target.value })} required placeholder="Ej: Villa Elisa" />
                                </div>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '11px' }}>Tipo</label>
                                    <select className="form-input" value={ubiForm.tipo} onChange={e => setUbiForm({ ...ubiForm, tipo: e.target.value })}>
                                        <option value="FABRICA">🏭 Fábrica</option>
                                        <option value="LOCAL">🏪 Local / Venta</option>
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>Añadir</button>
                            </form>

                            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Tipo</th>
                                            <th style={{ textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ubicaciones.map(u => (
                                            <tr key={u.id}>
                                                <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                                                <td>
                                                    <span className="badge" style={{ background: u.tipo === 'FABRICA' ? '#E8F5E9' : '#E3F2FD', color: u.tipo === 'FABRICA' ? '#2E7D32' : '#1565C0', border: 'none' }}>
                                                        {u.tipo === 'FABRICA' ? '🏭 Fábrica' : '🏪 Local'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn btn-icon btn-ghost" style={{ color: '#E74C3C' }} onClick={async () => {
                                                        if (!confirm('¿Eliminar esta sede? Se perderán las asociaciones de stock.')) return
                                                        await fetch(`/api/ubicaciones?id=${u.id}`, { method: 'DELETE' })
                                                        fetchData()
                                                    }}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {ubicaciones.length === 0 && (
                                            <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No hay sedes configuradas. Configurá al menos una para operar.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Registrar Merma por Planchas */}
            {showMermaModal && (
                <div className="modal-overlay" onClick={() => setShowMermaModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>⚠️ Registrar Merma</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowMermaModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleMermaSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Producto y Presentación</label>
                                    <select
                                        className="form-select"
                                        value={`${mermaForm.productoId}_${mermaForm.presentacionId}`}
                                        onChange={e => {
                                            const [pId, prId] = e.target.value.split('_')
                                            setMermaForm({ ...mermaForm, productoId: pId || '', presentacionId: prId || '' })
                                        }}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {productos.flatMap(p =>
                                            (p.presentaciones || []).map(pr => (
                                                <option key={`${p.id}_${pr.id}`} value={`${p.id}_${pr.id}`}>
                                                    [x{pr.cantidad}] {p.nombre} ({p.planchasPorPaquete} pl/paq)
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Ubicación</label>
                                    <select className="form-select" value={mermaForm.ubicacionId} onChange={e => setMermaForm({ ...mermaForm, ubicacionId: e.target.value })} required>
                                        <option value="">Seleccionar...</option>
                                        {ubicaciones.map(u => <option key={u.id} value={u.id}>{u.tipo === 'FABRICA' ? '🏭' : '🏪'} {u.nombre}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Cantidad de planchas</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={mermaForm.planchas}
                                            onChange={e => setMermaForm({ ...mermaForm, planchas: e.target.value })}
                                            placeholder="Ej: 2"
                                            required
                                            min="1"
                                            style={{ fontSize: '18px' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo</label>
                                        <select className="form-select" value={mermaForm.motivo} onChange={e => setMermaForm({ ...mermaForm, motivo: e.target.value })} required>
                                            <option value="">Seleccionar...</option>
                                            <option value="Mal corte">Mal corte</option>
                                            <option value="Vencimiento">Vencimiento</option>
                                            <option value="Problema de calidad">Problema de calidad</option>
                                            <option value="Rotura">Rotura / daño</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                </div>
                                {planchasNum > 0 && mermaProducto && (
                                    <div style={{
                                        padding: 'var(--space-3)', backgroundColor: '#FFF5F5', borderRadius: 'var(--radius-md)',
                                        border: '1px solid #FECACA', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 'var(--text-sm)', color: '#991B1B', fontWeight: 600 }}>
                                                {planchasNum} planchas = {paquetesMerma % 1 === 0 ? paquetesMerma : paquetesMerma.toFixed(2)} paquetes
                                            </div>
                                            <div style={{ fontSize: 'var(--text-xs)', color: '#B91C1C' }}>
                                                Se descontarán <strong>{Math.ceil(paquetesMerma)} paq</strong> del stock de {mermaProducto.nombre}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '1.5rem' }}>🗑️</div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowMermaModal(false)}>Cancelar</button>
                                <button type="submit" className="btn" style={{ backgroundColor: '#E74C3C', color: '#fff', fontWeight: 600 }} disabled={planchasNum <= 0}>
                                    Registrar Merma
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Importar Excel de Planificación */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" style={{ maxWidth: '640px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📥 Importar Necesidades desde Excel</h3>
                            <button className="btn btn-ghost" style={{ fontSize: '1.2rem' }} onClick={() => setShowImportModal(false)}>✕</button>
                        </div>

                        {importStep === 'upload' && (
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: '12px', color: 'var(--color-gray-600)' }}>
                                    <strong>Formato esperado del Excel:</strong><br />
                                    Mínimo 2 columnas: una para el <strong>Turno</strong> (Mañana / Siesta / Tarde) y otra para <strong>Necesidades</strong> (ej: <code>48jyq 24clasicos 12esp</code>).
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Archivo Excel (.xlsx / .xls)</label>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="form-input"
                                        onChange={e => { if (e.target.files?.[0]) handleExcelFile(e.target.files[0]) }}
                                    />
                                </div>
                                {importHeaders.length > 0 && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label">Columna de Turno</label>
                                                <select className="form-select" value={importColTurno} onChange={e => setImportColTurno(e.target.value)}>
                                                    <option value="">— Seleccionar —</option>
                                                    {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Columna de Necesidades</label>
                                                <select className="form-select" value={importColTexto} onChange={e => setImportColTexto(e.target.value)}>
                                                    <option value="">— Seleccionar —</option>
                                                    {importHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--color-gray-500)' }}>
                                            {importRawRows.length} filas detectadas. Fecha destino: <strong>{formatDateOnly((filterFecha || getLocalDateString()) + 'T00:00:00')}</strong>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {importStep === 'preview' && (
                            <div className="modal-body">
                                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <span className="badge" style={{ background: '#2ECC71', color: '#fff' }}>✅ {importSummary.ok} OK</span>
                                    <span className="badge" style={{ background: '#F39C12', color: '#fff' }}>⚠ {importSummary.parcial} Parciales</span>
                                    <span className="badge" style={{ background: '#E74C3C', color: '#fff' }}>✕ {importSummary.error} Errores</span>
                                </div>
                                <div className="table-container" style={{ margin: 0, maxHeight: '360px', overflowY: 'auto' }}>
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Turno</th>
                                                <th>Texto original</th>
                                                <th>Productos detectados</th>
                                                <th style={{ textAlign: 'center' }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.map((r: any, i: number) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.turnoNorm || <span style={{ color: 'var(--color-danger)' }}>{r.turnoRaw}</span>}</td>
                                                    <td style={{ fontSize: '11px', color: 'var(--color-gray-500)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.texto}</td>
                                                    <td style={{ fontSize: '11px' }}>
                                                        {r.items?.length > 0
                                                            ? r.items.map((it: any) => <span key={it.productoId} className="badge badge-info" style={{ marginRight: '2px' }}>{it.productoNombre} ×{it.cantidadPaquetes}</span>)
                                                            : <span style={{ color: 'var(--color-danger)', fontSize: '10px' }}>{r.errores?.[0] || 'Sin datos'}</span>
                                                        }
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {r.status === 'ok' && <span style={{ color: '#2ECC71' }}>✅</span>}
                                                        {r.status === 'parcial' && <span style={{ color: '#F39C12' }}>⚠</span>}
                                                        {(r.status === 'sin_turno' || r.status === 'sin_match') && <span style={{ color: '#E74C3C' }}>✕</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {importSummary.ok === 0 && importSummary.parcial === 0 && (
                                    <div style={{ color: 'var(--color-danger)', marginTop: 'var(--space-2)', fontSize: '12px' }}>
                                        No hay filas válidas para importar. Verificá el formato del archivo.
                                    </div>
                                )}
                            </div>
                        )}

                        {importStep === 'done' && (
                            <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <div style={{ fontSize: '48px' }}>✅</div>
                                <p style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>¡Importación completada!</p>
                                <p style={{ color: 'var(--color-gray-500)', fontSize: '13px' }}>Los requerimientos ya están cargados en el planificador.</p>
                            </div>
                        )}

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowImportModal(false)}>Cerrar</button>
                            {importStep === 'upload' && (
                                <button className="btn btn-primary" onClick={handleImportPreview} disabled={importLoading || !importColTurno || !importColTexto}>
                                    {importLoading ? 'Analizando...' : 'Ver Preview →'}
                                </button>
                            )}
                            {importStep === 'preview' && (importSummary.ok > 0 || importSummary.parcial > 0) && (
                                <>
                                    <button className="btn btn-ghost" onClick={() => setImportStep('upload')}>← Volver</button>
                                    <button className="btn btn-primary" onClick={handleImportConfirm} disabled={importLoading}>
                                        {importLoading ? 'Importando...' : `Confirmar (${importSummary.ok + importSummary.parcial} filas)`}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
