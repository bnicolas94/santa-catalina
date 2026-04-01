'use client'

import { useState, useEffect } from 'react'
import { useProduccionData } from '@/components/produccion/hooks/useProduccionData'

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
    const [showModal, setShowModal] = useState(false)
    const [showCerrarModal, setShowCerrarModal] = useState(false)
    const [loteSeleccionado, setLoteSeleccionado] = useState<Lote | null>(null)
    const [filterEstado, setFilterEstado] = useState('')
    const [filterFecha, setFilterFecha] = useState(getLocalDateString())

    const { data: swrData, isLoading: loading, mutate } = useProduccionData(filterFecha || getLocalDateString())
    const fetchData = () => mutate()

    const lotes = swrData?.lotes || []
    const productos = swrData?.productos || []
    const coordinadores = swrData?.coordinadores || []
    const movimientos = swrData?.movimientos || []
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [form, setForm] = useState({
        productoId: '',
        presentacionId: '',
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
    const stockProductos = swrData?.stockProductos || []
    interface PlanningData {
        necesidades: Record<string, Record<string, number>>
        infoProductos: Record<string, any>
        manuales?: Record<string, Record<string, number>>
        manualesDetalle?: Record<string, Record<string, { fabrica: number, local: number }>>
        stockFabricacion: Record<string, number>
        stockLocal: Record<string, number>
        enProduccion: Record<string, number>
        shipmentCounts?: Record<string, number>
        descuentosRealizados?: string[]
    }
    const planning = swrData?.planning || null
    const [activeTurno, setActiveTurno] = useState('Mañana')
    const [filterDestino, setFilterDestino] = useState<'TODOS' | 'FABRICA' | 'LOCAL'>('TODOS')
    interface UbicacionOption { id: string, nombre: string, tipo: string }
    const ubicaciones = swrData?.ubicaciones || []

    useEffect(() => {
        if (!form.ubicacionId && ubicaciones.length > 0) {
            const def = ubicaciones.find((u: UbicacionOption) => u.tipo === 'FABRICA') || ubicaciones[0]
            setForm(f => ({ ...f, ubicacionId: def.id }))
        }
    }, [ubicaciones, form.ubicacionId])
    const [showMovModal, setShowMovModal] = useState(false)
    const [movForm, setMovForm] = useState({ productoId: '', presentacionId: '', tipo: 'traslado', cantidad: '', observaciones: '' })
    const [movExtraForm, setMovExtraForm] = useState({ ubicacionId: '', destinoUbicacionId: '' })
    const [showMinStockModal, setShowMinStockModal] = useState(false)
    const [minStockForm, setMinStockForm] = useState({ presentacionId: '', stockMinimo: '' })
    const [showUbiModal, setShowUbiModal] = useState(false)
    const [ubiForm, setUbiForm] = useState({ nombre: '', tipo: 'FABRICA' })
    const [showMermaModal, setShowMermaModal] = useState(false)
    const [mermaForm, setMermaForm] = useState({ productoId: '', presentacionId: '', planchas: '', motivo: '', ubicacionId: '' })
    const [stockSource, setStockSource] = useState<'fabrica' | 'local' | 'ambos'>('fabrica')

    // Estado para importación Excel
    const [showImportModal, setShowImportModal] = useState(false)
    const [importStep, setImportStep] = useState<'upload' | 'preview' | 'done'>('upload')
    const [importMode, setImportMode] = useState<'file' | 'paste'>('file')
    const [importColTurno, setImportColTurno] = useState('')
    const [importColTexto, setImportColTexto] = useState('')
    const [importColFecha, setImportColFecha] = useState('')
    const [importColDestino, setImportColDestino] = useState('')
    const [importHeaders, setImportHeaders] = useState<string[]>([])
    const [importRawRows, setImportRawRows] = useState<any[]>([])
    const [importPreview, setImportPreview] = useState<any[]>([])
    const [importSummary, setImportSummary] = useState({ ok: 0, parcial: 0, error: 0 })
    const [importLoading, setImportLoading] = useState(false)
    const [showDiscountModal, setShowDiscountModal] = useState(false)
    const [isDiscounting, setIsDiscounting] = useState(false)
    const isDiscounted = activeTurno !== 'Totales' && !!planning?.descuentosRealizados?.includes(activeTurno)
    const showDiscountedUI = isDiscounted && filterDestino !== 'LOCAL'

    useEffect(() => {
        if (filterDestino === 'LOCAL') setStockSource('local')
        else if (filterDestino === 'FABRICA') setStockSource('fabrica')
        else setStockSource('ambos')
    }, [filterDestino])

    // Data fetching and polling is now handled entirely by the useProduccionData SWR hook.

    async function handleDescontar() {
        if (!activeTurno || activeTurno === 'Totales') return
        setIsDiscounting(true)
        try {
            const res = await fetch('/api/produccion/planificacion/descontar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: filterFecha || getLocalDateString(),
                    turno: activeTurno
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(data.message)
            fetchData()
            setShowDiscountModal(false)
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsDiscounting(false)
        }
    }

    const mutatePlanning = () => {
        fetchData() // Re-fetch all data to update planning
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
        const defaultPresentacionId = prod?.presentaciones?.[0]?.id || ''
        setForm({ ...form, productoId: val, presentacionId: defaultPresentacionId, paquetesPersonales: val ? String(paq) : '' })
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
                    presentacionId: form.presentacionId,
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
                presentacionId: '',
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
            ubicacionId: lote.ubicacion?.id || '',
            distribucionPresentaciones: distribucion
        })
        setShowCerrarModal(true)
    }

    async function handleQuickCloseLote(lote: any) {
        if (lote.estado !== 'en_produccion') return
        if (!confirm(`¿Deseas pasar el Lote ${lote.id} a CÁMARA automáticamente?\n(Se asumirán 0 rechazos y distribución total a ${lote.producto.nombre})`)) return

        setError('')
        try {
            const presentaciones = lote.producto.presentaciones || []
            const cantProducida = lote.unidadesProducidas || 0
            
            // Distribución por defecto: todo a la primera presentación
            const distribucion = presentaciones.map((pred: any, idx: number) => ({
                presentacionId: pred.id,
                cantidad: idx === 0 ? cantProducida : 0
            }))

            const res = await fetch(`/api/lotes/${lote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: 'en_camara',
                    unidadesRechazadas: 0,
                    motivoRechazo: null,
                    unidadesProducidas: cantProducida,
                    empleadosRonda: lote.empleadosRonda,
                    fechaProduccion: lote.fechaProduccion.slice(0, 10),
                    coordinadorId: lote.coordinador?.id || '',
                    ubicacionId: lote.ubicacion?.id || '',
                    horaFin: new Date().toISOString(),
                    distribucionPresentaciones: distribucion
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al actualizar')
            }
            
            setSuccess('Lote pasado a cámara correctamente')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
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

    const handleClearPlan = async () => {
        if (!confirm('¿Estás seguro de que quieres borrar todos los requerimientos manuales de este día?')) return
        try {
            const res = await fetch(`/api/produccion/planificacion?fecha=${filterFecha || getLocalDateString()}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                mutatePlanning()
            } else {
                const data = await res.json()
                throw new Error(data.error || 'Error al borrar')
            }
        } catch (error: any) {
            setError(error.message)
        }
    }

    const handleSaveManual = async (productoId: string, presentacionId: string | null, value: string, turno: string) => {
        try {
            const key = presentacionId ? `${productoId}_${presentacionId}` : `${productoId}_null`;
            const prod = planning?.infoProductos[key];

            const multiplier = prod?.presentacion?.cantidad || 48; // Default to 48 if not found
            const cantidadUnits = Math.round(parseFloat(value || '0') * multiplier);

            const res = await fetch('/api/produccion/planificacion/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: filterFecha || getLocalDateString(),
                    turno,
                    productoId,
                    presentacionId,
                    cantidad: cantidadUnits,
                    destino: filterDestino === 'LOCAL' ? 'LOCAL' : 'FABRICA'
                })
            });
            if (res.ok) {
                mutatePlanning();
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Error al guardar');
            }
        } catch (error: any) {
            setError(error.message);
        }
    };

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
            const fechaCol = headers.find(h => /fecha|dia|date/i.test(h)) || ''
            setImportColTurno(turnoCol)
            setImportColTexto(textoCol)
            setImportColFecha(fechaCol)
        } catch (err: any) {
            setError('Error al leer el archivo: ' + err.message)
        }
    }

    function handlePasteText(text: string) {
        try {
            // 1. Obtener cabeceras (primera línea no vacía)
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
            if (lines.length < 2) return

            const headers = lines[0].split('\t').map((h, i) => h.trim() || `Columna ${i + 1}`)
            setImportHeaders(headers)

            // 2. Obtener datos
            const rows = lines.slice(1).map(line => {
                const values = line.split('\t')
                const row: any = {}
                headers.forEach((h, idx) => {
                    row[h] = (values[idx] || '').trim()
                })
                return row
            })
            setImportRawRows(rows)

            // Auto-detectar columnas
            const turnoCol = headers.find(h => /turno/i.test(h)) || ''
            const textoCol = headers.find(h => /neces|pedido|prod|item|detalle/i.test(h)) || ''
            const fechaCol = headers.find(h => /fecha|dia|date/i.test(h)) || ''
            setImportColTurno(turnoCol)
            setImportColTexto(textoCol)
            setImportColFecha(fechaCol)
        } catch (err: any) {
            setError('Error al procesar el texto pegado: ' + err.message)
        }
    }

    async function handleImportPreview() {
        if (!importColTurno || !importColTexto) { setError('Seleccioná las columnas de Turno y Necesidades.'); return }
        setImportLoading(true)
        try {
            const filas = importRawRows.map(r => ({
                fechaRaw: importColFecha ? r[importColFecha] : null,
                turno: String(r[importColTurno] || ''),
                texto: String(r[importColTexto] || ''),
                destino: importColDestino ? String(r[importColDestino] || '') : ''
            }))
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
            const filas = importRawRows.map(r => ({
                fechaRaw: importColFecha ? r[importColFecha] : null,
                turno: String(r[importColTurno] || ''),
                texto: String(r[importColTexto] || ''),
                destino: importColDestino ? String(r[importColDestino] || '') : ''
            }))
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
            <div className="page-header">
                <h1>🏭 Producción — Lotes</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        className="form-input"
                        value={filterFecha}
                        onChange={(e) => setFilterFecha(e.target.value)}
                        title="Filtrar por fecha"
                        style={{ height: '38px', width: 'auto', flex: '1', minWidth: '130px' }}
                    />
                    {filterFecha && (
                        <button className="btn btn-ghost" onClick={() => setFilterFecha('')} title="Ver todas las fechas" style={{ padding: '0 8px', fontSize: '1.2rem' }}>
                            ✕
                        </button>
                    )}
                    <button className="btn btn-primary" style={{ flex: '1', minWidth: '120px' }} onClick={() => {
                        setForm(f => ({ ...f, fechaProduccion: filterFecha || new Date().toISOString().slice(0, 10) }))
                        setShowModal(true)
                    }}>+ Nuevo Lote</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {/* Planificación por Turnos */}
            {planning && (
                <div className="card" style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}>
                    <div className="card-body" style={{ padding: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>📅 Planificación — {formatDateOnly(filterFecha || getLocalDateString())}</h2>
                                <span className="badge badge-info" style={{ fontSize: '10px' }}>Basado en Hoja de Ruta</span>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                gap: '8px', 
                                alignItems: 'center', 
                                width: '100%', 
                                overflowX: 'auto', 
                                paddingBottom: '4px',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none'
                            }}>
                                <button
                                    className="btn btn-xs btn-ghost"
                                    style={{ fontSize: '10px', padding: '4px 10px', border: '1px dashed var(--color-gray-300)', whiteSpace: 'nowrap' }}
                                    onClick={() => { setImportStep('upload'); setImportHeaders([]); setImportRawRows([]); setShowImportModal(true) }}
                                >
                                    📥 Importar
                                </button>
                                <button
                                    className="btn btn-xs btn-ghost"
                                    style={{ fontSize: '10px', padding: '4px 10px', color: 'var(--color-error)', border: '1px solid transparent', whiteSpace: 'nowrap' }}
                                    onClick={handleClearPlan}
                                    title="Limpiar"
                                >
                                    🗑️ Limpiar
                                </button>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-gray-100)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                                    {['Mañana', 'Siesta', 'Tarde', 'Totales'].map(t => (
                                        <button
                                            key={t}
                                            className={`btn btn-xs ${activeTurno === t ? (t === 'Totales' ? 'btn-success' : 'btn-primary') : 'btn-ghost'}`}
                                            onClick={() => setActiveTurno(t)}
                                            style={{ fontSize: '10px', padding: '4px 10px', whiteSpace: 'nowrap', ...(t === 'Totales' ? { fontWeight: 700 } : {}) }}
                                        >
                                            {t === 'Totales' ? '📊 Totales' : t}
                                            {(planning?.shipmentCounts?.[t] ?? 0) > 0 && (
                                                <span style={{ 
                                                    marginLeft: '6px', 
                                                    backgroundColor: activeTurno === t ? 'white' : 'var(--color-gray-300)', 
                                                    color: activeTurno === t ? 'var(--color-primary)' : 'var(--color-gray-700)', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '12px', 
                                                    fontSize: '10px',
                                                    fontWeight: 800,
                                                    boxShadow: activeTurno === t ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                                }}>
                                                    {planning?.shipmentCounts?.[t]}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-gray-200)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-300)' }}>
                                    {(['TODOS', 'FABRICA', 'LOCAL'] as const).map(d => (
                                        <button
                                            key={d}
                                            className={`btn btn-xs ${filterDestino === d ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setFilterDestino(d)}
                                            style={{ fontSize: '14px', padding: '6px 10px', whiteSpace: 'nowrap' }}
                                            title={d === 'TODOS' ? 'Ver todo el stock' : d === 'FABRICA' ? 'Solo Stock Fábrica' : 'Solo Stock Local'}
                                        >
                                            {d === 'TODOS' ? '🌐' : d === 'FABRICA' ? '🏭' : '🏪'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="table table-planning">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th style={{ textAlign: 'center' }} className="hidden-mobile">H. Ruta</th>
                                        <th style={{ textAlign: 'center' }}>Total</th>
                                        {!showDiscountedUI && (
                                            <>
                                                <th style={{ textAlign: 'center' }}>Stock</th>
                                                <th style={{ textAlign: 'center' }} className="hidden-mobile">Proceso</th>
                                                <th style={{ textAlign: 'center' }}>Falta</th>
                                                <th style={{ textAlign: 'center' }}>Final</th>
                                            </>
                                        )}
                                        <th style={{ textAlign: 'right' }}>{showDiscountedUI ? 'Estado' : 'Acción'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTurno === 'Totales' ? (() => {
                                        // Consolidar todos los turnos, considerando el filtro de destino
                                        const todosPids = new Set<string>()
                                        Object.values(planning?.necesidades || {}).forEach(t => {
                                            if (t) Object.keys(t).forEach(pid_presid => todosPids.add(pid_presid))
                                        })

                                        const consolidado: Record<string, { ruta: number, manual: number, total: number }> = {}
                                        const manualesDetalleConsolidado: Record<string, { fabrica: number, local: number }> = {}

                                        // Consolidar manuales detalle de todos los turnos
                                        Object.values(planning?.manualesDetalle || {}).forEach((turnoData: any) => {
                                            if (!turnoData) return;
                                            Object.entries(turnoData).forEach(([key, det]: [string, any]) => {
                                                if (!manualesDetalleConsolidado[key]) manualesDetalleConsolidado[key] = { fabrica: 0, local: 0 }
                                                manualesDetalleConsolidado[key].fabrica += det.fabrica || 0
                                                manualesDetalleConsolidado[key].local += det.local || 0
                                            })
                                        })

                                        todosPids.forEach(pid_presid => {
                                            const totalUnitsOriginal = Object.values(planning?.necesidades || {}).reduce((sum: number, t: any) => sum + (t?.[pid_presid] || 0), 0) as number
                                            const det = manualesDetalleConsolidado[pid_presid] || { fabrica: 0, local: 0 }
                                            const rutaUnitsTotal = Math.max(0, totalUnitsOriginal - (det.fabrica + det.local))
                                            
                                            // Aplicar lógica de filtro: rutaUnits siempre es fábrica
                                            const rutaUnits = filterDestino === 'LOCAL' ? 0 : rutaUnitsTotal
                                            const manualUnits = filterDestino === 'TODOS' ? (det.fabrica + det.local) : (filterDestino === 'LOCAL' ? det.local : det.fabrica)

                                            consolidado[pid_presid] = {
                                                ruta: rutaUnits,
                                                manual: manualUnits,
                                                total: rutaUnits + manualUnits
                                            }
                                        })

                                        // ALFABÉTICO POR CÓDIGO INTERNO
                                        const items = Object.entries(consolidado).sort(([keyA], [keyB]) => {
                                            const codeA = planning?.infoProductos?.[keyA]?.codigoInterno || ''
                                            const codeB = planning?.infoProductos?.[keyB]?.codigoInterno || ''
                                            return codeA.localeCompare(codeB)
                                        })

                                        if (items.length === 0) return (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--space-4)' }}>No hay requerimientos cargados para hoy</td></tr>
                                        )

                                        return (
                                            <>
                                                {items.map(([key, data]) => {
                                                    const { ruta, manual, total: totalUnits } = data
                                                    if (totalUnits === 0 && filterDestino !== 'TODOS') return null
                                                    const prodInfo = planning.infoProductos[key]
                                                    const presSize = prodInfo?.presentacion?.cantidad || 48
                                                    const pid = prodInfo?.id
                                                    const stockSource = filterDestino === 'LOCAL' ? 'local' : (filterDestino === 'FABRICA' ? 'fabrica' : 'ambos')
                                                    const stockValue = (() => {
                                                        const fab = planning?.stockFabricacion?.[key] || 0
                                                        const loc = planning?.stockLocal?.[key] || 0
                                                        if (stockSource === 'fabrica') return fab
                                                        if (stockSource === 'local') return loc
                                                        return fab + loc
                                                    })()

                                                    const enProcUnits = prodInfo?.isPrimary ? (planning?.enProduccion?.[pid] || 0) : 0
                                                    
                                                    // --- CORRECCIÓN EN TOTALES ---
                                                    // 1. Pendientes de días anteriores
                                                    const pendAnteriores = planning?.pendientesAnteriores?.[key] || 0
                                                    
                                                    // 2. Solo lo que Falta descontar de HOY
                                                    let pendHoy = 0
                                                    const TURNOS_POSIBLES = ['Mañana', 'Siesta', 'Tarde']
                                                    TURNOS_POSIBLES.forEach(tNombre => {
                                                        const yaDescontado = planning?.descuentosRealizados?.includes(tNombre)
                                                        if (!yaDescontado) {
                                                            const necT = planning?.necesidades?.[tNombre]?.[key] || 0
                                                            const manT = planning?.manualesDetalle?.[tNombre]?.[key] || { fabrica: 0, local: 0 }
                                                            const rutaTRaw = Math.max(0, necT - (manT.fabrica + manT.local))
                                                            const rutaT = filterDestino === 'LOCAL' ? 0 : rutaTRaw
                                                            const manualT = filterDestino === 'TODOS' ? (manT.fabrica + manT.local) : (filterDestino === 'LOCAL' ? manT.local : manT.fabrica)
                                                            pendHoy += (rutaT + manualT)
                                                        }
                                                    })

                                                    const totalDeduccionProyectada = pendAnteriores + pendHoy
                                                    const faltanteUnits = Math.max(0, totalDeduccionProyectada - stockValue - enProcUnits)

                                                    const rutaPaq = (ruta / presSize).toFixed(1).replace('.0', '')
                                                    const manualPaq = (manual / presSize).toFixed(1).replace('.0', '')
                                                    const totalPaq = (totalUnits / presSize).toFixed(1).replace('.0', '')
                                                    const stockPaq = (stockValue / presSize).toFixed(1).replace('.0', '')
                                                    const enProcPaq = (enProcUnits / presSize).toFixed(1).replace('.0', '')
                                                    const faltantePaq = (faltanteUnits / presSize).toFixed(1).replace('.0', '')

                                                    const finalUnits = stockValue + enProcUnits - totalDeduccionProyectada
                                                    const finalPaq = (finalUnits / presSize).toFixed(1).replace('.0', '')
                                                    const finalColor = finalUnits < 0 ? 'var(--color-error)' : 'var(--color-success)'

                                                    const unitsPerRonda = (prodInfo?.paquetesPorRonda || 14) * presSize
                                                    const rondasReal = Math.ceil(faltanteUnits / unitsPerRonda)

                                                    return (
                                                        <tr key={key}>
                                                            <td>
                                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                                                    {prodInfo?.nombre}
                                                                    <span style={{ color: 'var(--color-primary)', marginLeft: '6px' }}>
                                                                        [{prodInfo?.presentacion?.cantidad ? `x${prodInfo.presentacion.cantidad}` : 'S/P'}]
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>{prodInfo?.codigoInterno}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-gray-500)' }}>{ruta > 0 ? `${rutaPaq} paq` : '—'}</td>
                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{totalPaq} paq</td>
                                                            <td style={{ textAlign: 'center', color: stockValue < totalUnits ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '12px' }}>
                                                                {stockPaq} paq
                                                                <div style={{ fontSize: '9px', color: 'var(--color-gray-400)' }}>
                                                                    {stockSource === 'fabrica' ? 'Solo Fábrica' : stockSource === 'local' ? 'Solo Local' : 'Stock Total'}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', color: '#F39C12', fontSize: '12px' }}>
                                                                {enProcUnits > 0 ? `${enProcPaq} paq` : (prodInfo?.isPrimary ? '—' : '')}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {faltanteUnits > 0 ? (
                                                                    <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '13px' }}>{faltantePaq} paq</span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--color-success)', fontSize: '12px' }}>Cubierto ✅</span>
                                                                )}
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 600, color: finalColor }}>{finalPaq} paq</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                {faltanteUnits > 0 ? (
                                                                    <button
                                                                        className="btn btn-xs btn-primary"
                                                                        onClick={() => {
                                                                            setForm({ ...form, productoId: pid, presentacionId: prodInfo.presentacion?.id || '', rondas: String(rondasReal), paquetesPersonales: String(rondasReal * (prodInfo?.paquetesPorRonda || 14)), fechaProduccion: filterFecha || getLocalDateString() })
                                                                            setShowModal(true)
                                                                        }}
                                                                    >
                                                                        Producir {rondasReal} rondas
                                                                    </button>
                                                                ) : '—'}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </>
                                        )
                                    })() : (() => {
                                        const TURNOS_ORDEN = ['Mañana', 'Siesta', 'Tarde'];
                                        const indexActual = TURNOS_ORDEN.indexOf(activeTurno);

                                        const necesidadesTurno = planning?.necesidades?.[activeTurno] || {}
                                        const manualesTurno = planning?.manualesDetalle?.[activeTurno] || {}

                                        // ALFABÉTICO POR CÓDIGO INTERNO
                                        const items = Object.entries(necesidadesTurno).sort(([keyA], [keyB]) => {
                                            const codeA = planning?.infoProductos?.[keyA]?.codigoInterno || ''
                                            const codeB = planning?.infoProductos?.[keyB]?.codigoInterno || ''
                                            return codeA.localeCompare(codeB)
                                        })

                                        if (items.length === 0) return (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--space-4)' }}>
                                                    No hay requerimientos para el turno {activeTurno}
                                                </td>
                                            </tr>
                                        )

                                        return items.map(([key, totalUnitsOriginal]: [string, any]) => {
                                            const prodInfo = planning.infoProductos[key]
                                            const presSize = prodInfo?.presentacion?.cantidad || 48
                                            const pid = prodInfo?.id
                                            const presid = prodInfo?.presentacion?.id || null

                                            const manInfo = manualesTurno[key] || { fabrica: 0, local: 0 }
                                            const rutaUnitsRaw = Math.max(0, totalUnitsOriginal - (manInfo.fabrica + manInfo.local))

                                            // Aplicar filtro
                                            const rutaUnits = filterDestino === 'LOCAL' ? 0 : rutaUnitsRaw
                                            const manualUnits = filterDestino === 'TODOS' ? (manInfo.fabrica + manInfo.local) : (filterDestino === 'LOCAL' ? manInfo.local : manInfo.fabrica)
                                            const totalUnits = rutaUnits + manualUnits

                                            if (totalUnits === 0 && filterDestino !== 'TODOS') return null

                                            // Stock dinámico según la fuente seleccionada
                                            const stockUnits = (() => {
                                                const fab = planning?.stockFabricacion?.[key] || 0
                                                const loc = planning?.stockLocal?.[key] || 0
                                                if (stockSource === 'fabrica') return fab
                                                if (stockSource === 'local') return loc
                                                return fab + loc
                                            })()

                                            const enProcUnits = prodInfo?.isPrimary ? (planning?.enProduccion?.[pid] || 0) : 0
                                            
                                            // --- CÁLCULO ACUMULATIVO ---
                                            // 1. Pendientes de días anteriores
                                            const pendAnteriores = planning?.pendientesAnteriores?.[key] || 0
                                            
                                            // 2. Pendientes de turnos anteriores del MISMO día
                                            let pendTurnosPrevios = 0
                                            if (indexActual > 0) {
                                                for (let i = 0; i < indexActual; i++) {
                                                    const tNombre = TURNOS_ORDEN[i]
                                                    const yaDescontado = planning?.descuentosRealizados?.includes(tNombre)
                                                    if (!yaDescontado) {
                                                        // Si no se descontó, sumamos su necesidad técnica (ajustada por filtro) al "bloqueo" de stock
                                                        const necT = planning?.necesidades?.[tNombre]?.[key] || 0
                                                        const manT = planning?.manualesDetalle?.[tNombre]?.[key] || { fabrica: 0, local: 0 }
                                                        const rutaTRaw = Math.max(0, necT - (manT.fabrica + manT.local))
                                                        const rutaT = filterDestino === 'LOCAL' ? 0 : rutaTRaw
                                                        const manualT = filterDestino === 'TODOS' ? (manT.fabrica + manT.local) : (filterDestino === 'LOCAL' ? manT.local : manT.fabrica)
                                                        pendTurnosPrevios += (rutaT + manualT)
                                                    }
                                                }
                                            }

                                            const totalDeduccionProyectada = totalUnits + pendAnteriores + pendTurnosPrevios
                                            const faltanteUnits = Math.max(0, totalDeduccionProyectada - stockUnits - enProcUnits)

                                            // Conversión a paquetes para mostrar
                                            const rutaPaq = (rutaUnits / presSize).toFixed(1).replace('.0', '')
                                            const manualPaq = (manualUnits / presSize).toFixed(1).replace('.0', '')
                                            const stockPaq = (stockUnits / presSize).toFixed(1).replace('.0', '')
                                            const enProcPaq = (enProcUnits / presSize).toFixed(1).replace('.0', '')
                                            const faltantePaq = (faltanteUnits / presSize).toFixed(1).replace('.0', '')

                                            const finalUnits = stockUnits + enProcUnits - totalDeduccionProyectada
                                            const finalPaq = (finalUnits / presSize).toFixed(1).replace('.0', '')
                                            const finalColor = finalUnits < 0 ? 'var(--color-error)' : 'var(--color-success)'
                                            const totalPaq = (totalUnits / presSize).toFixed(1).replace('.0', '')

                                            const unitsPerRonda = (prodInfo?.paquetesPorRonda || 14) * presSize
                                            const rondasReal = Math.ceil(faltanteUnits / unitsPerRonda)

                                            return (
                                                <tr key={key}>
                                                    <td>
                                                        <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                                            {prodInfo?.nombre}
                                                            <span style={{ color: 'var(--color-primary)', marginLeft: '6px' }}>
                                                                [{prodInfo?.presentacion?.cantidad ? `x${prodInfo.presentacion.cantidad}` : 'S/P'}]
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: 'var(--color-gray-500)' }}>{prodInfo?.codigoInterno}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-gray-500)' }}>{rutaUnits > 0 ? `${rutaPaq} paq` : '—'}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{totalPaq} paq</td>
                                                    {!showDiscountedUI && (
                                                        <>
                                                            <td style={{ textAlign: 'center', color: stockUnits < totalUnits ? 'var(--color-danger)' : 'var(--color-success)', fontSize: '12px' }}>
                                                                {stockPaq} paq
                                                            </td>
                                                            <td style={{ textAlign: 'center', color: '#F39C12', fontSize: '12px' }}>
                                                                {enProcUnits > 0 ? `${enProcPaq} paq` : (prodInfo?.isPrimary ? '—' : '')}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {faltanteUnits > 0 ? (
                                                                    <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: '13px' }}>{faltantePaq} paq</span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--color-success)', fontSize: '12px' }}>Cubierto ✅</span>
                                                                )}
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 600, color: finalColor }}>{finalPaq} paq</td>
                                                        </>
                                                    )}
                                                    <td style={{ textAlign: 'right' }}>
                                                        {showDiscountedUI ? (
                                                            <span style={{ color: 'var(--color-success)', fontSize: '11px', fontWeight: 600 }}>Stock Descontado ✅</span>
                                                        ) : (
                                                            faltanteUnits > 0 ? (
                                                                <button
                                                                    className="btn btn-xs btn-primary"
                                                                    onClick={() => {
                                                                        setForm({
                                                                            ...form,
                                                                            productoId: pid,
                                                                            presentacionId: presid || '',
                                                                            rondas: String(rondasReal),
                                                                            paquetesPersonales: String(rondasReal * (prodInfo?.paquetesPorRonda || 14)),
                                                                            fechaProduccion: filterFecha || getLocalDateString()
                                                                        })
                                                                        setShowModal(true)
                                                                    }}
                                                                >
                                                                    Producir {rondasReal} rondas
                                                                </button>
                                                            ) : '—'
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    })()}
                                    {/* Fila agregar producto extra / Descontar — solo en turnos normales y solo si NO es vista LOCAL */}
                                    {activeTurno !== 'Totales' && filterDestino !== 'LOCAL' && (
                                        <tr style={{ backgroundColor: 'var(--color-gray-50)' }}>
                                            <td colSpan={isDiscounted ? 2 : 2}>
                                                {!isDiscounted ? (
                                                    <select
                                                        className="form-select"
                                                        style={{ height: '32px', fontSize: '12px' }}
                                                        onChange={(e) => {
                                                            const val = e.target.value
                                                            if (val) {
                                                                const [pid, presid] = val.split('_')
                                                                handleSaveManual(pid, presid || null, '1', activeTurno)
                                                            }
                                                            e.target.value = ''
                                                        }}
                                                    >
                                                        <option value="">+ Agregar producto extra al turno {activeTurno}...</option>
                                                        {productos.flatMap(p =>
                                                            (p.presentaciones || []).map((pr: any) => {
                                                                const key = `${p.id}_${pr.id}`
                                                                if (planning.necesidades[activeTurno]?.[key]) return null
                                                                return (
                                                                    <option key={key} value={key}>
                                                                        [{p.codigoInterno}] {p.nombre} (x{pr.cantidad})
                                                                    </option>
                                                                )
                                                            })
                                                        )}
                                                    </select>
                                                ) : (
                                                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                                                        Este turno ya fue procesado y su stock descontado.
                                                    </div>
                                                )}
                                            </td>
                                            <td colSpan={isDiscounted ? 2 : 6} style={{ textAlign: 'right', verticalAlign: 'middle', paddingRight: 'var(--space-4)' }}>
                                                <button 
                                                    className={`btn btn-sm ${isDiscounted ? 'btn-ghost' : 'btn-primary'}`}
                                                    disabled={isDiscounted || isDiscounting || !planning?.necesidades[activeTurno]}
                                                    onClick={() => setShowDiscountModal(true)}
                                                    style={{ gap: 'var(--space-2)' }}
                                                >
                                                    {isDiscounted 
                                                        ? '✅ Stock Descontado' 
                                                        : `📦 Descontar Stock: Turno ${activeTurno}`
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                    )}
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
                            {stockProductos
                                .sort((a, b) => {
                                    const codeOrder: Record<string, number> = { 'JQ': 1, 'CLA': 2, 'ESP': 3 }
                                    const orderA = codeOrder[a.codigoInterno] || 99
                                    const orderB = codeOrder[b.codigoInterno] || 99
                                    if (orderA !== orderB) return orderA - orderB
                                    return b.cantidadPresentacion - a.cantidadPresentacion
                                })
                                .map(sp => {
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
                                                .map(([ubiName, qty]: [string, any]) => {
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

                    const sortedGroups = Object.values(grouped).sort((a: any, b: any) => a.producto.nombre.localeCompare(b.producto.nombre))

                    if (sortedGroups.length === 0) {
                        return (
                            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-gray-400)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>📋</div>
                                <p>No hay lotes registrados para los filtros seleccionados.</p>
                            </div>
                        )
                    }

                    return sortedGroups.map((group: any) => {
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
                                                    {group.lotes.map((lote: any) => {
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
                                                                    <span 
                                                                        className="badge" 
                                                                        style={{ 
                                                                            backgroundColor: `${est.color}15`, 
                                                                            color: est.color, 
                                                                            border: `1px solid ${est.color}30`, 
                                                                            fontSize: '10px', 
                                                                            padding: '2px 6px',
                                                                            cursor: lote.estado === 'en_produccion' ? 'pointer' : 'default',
                                                                            fontWeight: lote.estado === 'en_produccion' ? 700 : 400,
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                        onClick={() => lote.estado === 'en_produccion' && handleQuickCloseLote(lote)}
                                                                        title={lote.estado === 'en_produccion' ? 'Clic para pasar a CÁMARA automáticamente' : ''}
                                                                        onMouseEnter={(e) => {
                                                                            if (lote.estado === 'en_produccion') {
                                                                                e.currentTarget.style.backgroundColor = `${est.color}30`
                                                                                e.currentTarget.style.transform = 'scale(1.05)'
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (lote.estado === 'en_produccion') {
                                                                                e.currentTarget.style.backgroundColor = `${est.color}15`
                                                                                e.currentTarget.style.transform = 'scale(1)'
                                                                            }
                                                                        }}
                                                                    >
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
                                            (p.presentaciones || []).map((pr: any) => (
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
                                            (p.presentaciones || []).map((pr: any) => (
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
                            <h3>📥 Importar Necesidades</h3>
                            <button className="btn btn-ghost" style={{ fontSize: '1.2rem' }} onClick={() => { setShowImportModal(false); setImportHeaders([]); setImportRawRows([]); setImportStep('upload'); setImportMode('file'); }}>✕</button>
                        </div>

                        {importStep === 'upload' && (
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                {/* TABS DE MODO */}
                                <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 'var(--space-2)' }}>
                                    <button
                                        onClick={() => setImportMode('file')}
                                        style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: importMode === 'file' ? '2px solid #3498DB' : 'none', cursor: 'pointer', fontWeight: importMode === 'file' ? 'bold' : 'normal', color: importMode === 'file' ? '#3498DB' : '#666' }}
                                    >📁 Subir Excel</button>
                                    <button
                                        onClick={() => setImportMode('paste')}
                                        style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: importMode === 'paste' ? '2px solid #3498DB' : 'none', cursor: 'pointer', fontWeight: importMode === 'paste' ? 'bold' : 'normal', color: importMode === 'paste' ? '#3498DB' : '#666' }}
                                    >📋 Pegar desde Excel</button>
                                </div>

                                {importMode === 'file' ? (
                                    <div className="form-group">
                                        <label className="form-label">Archivo Excel (.xlsx / .xls)</label>
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            className="form-input"
                                            onChange={e => { if (e.target.files?.[0]) handleExcelFile(e.target.files[0]) }}
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Pegar celdas de Excel (incluir encabezados)</label>
                                        <textarea
                                            className="form-input"
                                            style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '11px' }}
                                            placeholder={"Ejemplo:\nTurno\tNecesidades\nMañana\t10 48jyq\nSiesta\t5 24jyq"}
                                            onChange={(e) => handlePasteText(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: '12px', color: 'var(--color-gray-600)' }}>
                                    <strong>Formato esperado:</strong><br />
                                    Al menos 2 columnas: una para el <strong>Turno</strong> y otra para <strong>Necesidades</strong>.
                                </div>
                                {importHeaders.length > 0 && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '10px' }}>Columna Fecha</label>
                                                <select className="form-select" value={importColFecha} onChange={e => setImportColFecha(e.target.value)}>
                                                    <option key="auto-hoy" value="">(Auto: Hoy)</option>
                                                    {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '10px' }}>Columna Turno</label>
                                                <select className="form-select" value={importColTurno} onChange={e => setImportColTurno(e.target.value)}>
                                                    <option value="">— Seleccionar —</option>
                                                    {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '10px' }}>Columna Necesidades</label>
                                                <select className="form-select" value={importColTexto} onChange={e => setImportColTexto(e.target.value)}>
                                                    <option value="">— Seleccionar —</option>
                                                    {importHeaders.map((h, idx) => <option key={`${h}_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: '10px' }}>Columna Destino</label>
                                                <select className="form-select" value={importColDestino} onChange={e => setImportColDestino(e.target.value)}>
                                                    <option key="auto-destino" value="">(Auto: Fábrica)</option>
                                                    {importHeaders.map((h, idx) => <option key={`hdest_${idx}`} value={h}>{h || `Columna ${idx + 1}`}</option>)}
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
                                                <th style={{ width: '90px' }}>Fecha</th>
                                                <th style={{ width: '90px' }}>Turno</th>
                                                <th style={{ width: '80px' }}>Destino</th>
                                                <th>Texto original</th>
                                                <th>Productos detectados</th>
                                                <th style={{ textAlign: 'center' }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.map((r: any, i: number) => (
                                                <tr key={i}>
                                                    <td style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{r.fechaValue ? formatDateOnly(r.fechaValue) : '—'}</td>
                                                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.turnoNorm || <span style={{ color: 'var(--color-danger)' }}>{r.turnoRaw}</span>}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`badge ${r.destino === 'LOCAL' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: '10px' }}>
                                                            {r.destino}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '11px', color: 'var(--color-gray-500)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.texto}</td>
                                                    <td style={{ fontSize: '11px' }}>
                                                        {r.items?.length > 0
                                                            ? r.items.map((it: any, itIdx: number) => (
                                                                <span key={`${it.productoId}_${itIdx}`} className="badge badge-info" style={{ marginRight: '2px' }}>
                                                                    {it.productoNombre} ×{it.cantidadPaquetes}
                                                                </span>
                                                            ))
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
            {showDiscountModal && (
                <div className="modal-overlay" style={{ display: 'flex', zIndex: 9999 }} onClick={(e) => e.target === e.currentTarget && setShowDiscountModal(false)}>
                    <div className="modal" style={{ maxWidth: '500px', backgroundColor: '#fff' }}>
                        <div className="modal-header">
                            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Confirmar Descuento de Stock: {activeTurno}</h2>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowDiscountModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ margin: 0, color: 'var(--color-gray-600)', marginBottom: 'var(--space-4)' }}>
                                Se descontarán los siguientes paquetes del **Stock de Fábrica**. Esta acción generará movimientos de egreso automáticos.
                            </p>
                            <div className="table-container" style={{ margin: 0, maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-sm)' }}>
                                <table className="table table-sm">
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#fff' }}>
                                        <tr>
                                            <th>Producto</th>
                                            <th style={{ textAlign: 'center' }}>Total</th>
                                            <th style={{ textAlign: 'center' }}>A Descontar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries((planning?.necesidades?.[activeTurno] || {}) as Record<string, number>).map(([key, units]) => {
                                            const prod = planning?.infoProductos?.[key]
                                            if (!prod || !prod.presentacion || units <= 0) return null
                                            const packetsToSubtract = Math.ceil(units / prod.presentacion.cantidad)
                                            return (
                                                <tr key={key}>
                                                    <td style={{ fontSize: '12px' }}>
                                                        <span className="badge badge-neutral" style={{ marginRight: '8px' }}>{prod.codigoInterno}</span>
                                                        <strong>{prod.nombre}</strong> (x{prod.presentacion.cantidad})
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{units} uni</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="badge badge-danger" style={{ background: 'var(--color-danger)', color: '#fff', padding: '4px 10px', borderRadius: '14px', fontWeight: 700 }}>
                                                            -{packetsToSubtract} paq
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: '#FEF9E7', borderRadius: 'var(--radius-md)', border: '1px solid #F7DC6F', color: '#B7950B', fontSize: '11px' }}>
                                ⚠️ <strong>Nota:</strong> Solo se descuentan requerimientos destinados a Fábrica (Repartos). Los pedidos con destino "LOCAL" (Retiros) deben ser descontados desde logística o entrega final.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowDiscountModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleDescontar} disabled={isDiscounting}>
                                {isDiscounting ? 'Descontando...' : 'Confirmar y Descontar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
