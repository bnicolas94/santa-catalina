'use client'

import { useState, useEffect, Suspense, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'

interface StockInsumoResumen { ubicacionId: string; cantidad: number }
interface Insumo { id: string; nombre: string; unidadMedida: string; stockActual: number; unidadSecundaria?: string; factorConversion?: number; stockActualSecundario?: number; stocks?: StockInsumoResumen[]; proveedor?: { id: string; nombre: string }; proveedores?: Array<{ proveedor: { id: string; nombre: string } }> }
interface Proveedor { id: string; nombre: string }
interface Ubicacion { id: string; nombre: string; tipo: string }
interface CajaCompra { tipo: string }
interface PagoForm { cajaOrigen: string; monto: string }
interface ItemFacturaForm {
    movimientoId?: string
    insumoId: string
    insumoNombre: string
    cantidad: string
    cantidadSecundaria: string
    costoTotal: string
    actualizarCosto: boolean
    useBultos: boolean
    bultos: string
    unidadesPorBulto: string
    fechaVencimiento: string
    unidadMedida: string
    unidadSecundaria?: string
}
interface CompraResumen { id: string; costoTotal: number; montoPagado: number; estadoPago: string; numeroFactura: string | null }
interface CompraCompleta {
    id: string
    numeroFactura: string | null
    fechaMovimiento: string
    fechaFactura: string | null
    estadoPago: string
    costoTotal: number
    montoPagado: number
    observaciones: string | null
    proveedor: { id: string; nombre: string } | null
    ubicacion: { id: string; nombre: string } | null
    movimientosStock: Array<{
        id: string
        cantidad: number
        cantidadSecundaria: number | null
        costoTotal: number | null
        fechaVencimiento: string | null
        insumo: { id: string; nombre: string; unidadMedida: string; unidadSecundaria?: string | null }
    }>
}
interface Movimiento {
    id: string; tipo: string; cantidad: number; cantidadSecundaria: number | null; fecha: string; observaciones: string | null
    costoTotal: number | null; estadoPago: string | null; fechaVencimiento: string | null; numeroFactura: string | null;
    montoPagado: number | null; fechaFactura: string | null;
    insumo: { id: string; nombre: string; unidadMedida: string; unidadSecundaria?: string | null }
    proveedor: { id: string; nombre: string } | null
    ubicacion: { id: string; nombre: string } | null
    compra: CompraResumen | null
}
interface CuentaCorrienteFactura {
    id: string
    numeroFactura: string | null
    fecha: string
    costoTotal: number
    montoPagado: number
    saldoPendiente: number
    origen: 'compra' | 'historico'
}
interface CuentaCorrienteProveedor {
    proveedorId: string | null
    proveedorNombre: string
    cantidadFacturas: number
    totalFacturado: number
    totalPagado: number
    saldoPendiente: number
    fechaMasAntigua: string | null
    facturas: CuentaCorrienteFactura[]
}
interface CuentaCorriente {
    cantidadProveedores: number
    cantidadFacturas: number
    totalFacturado: number
    totalPagado: number
    totalPendiente: number
    proveedores: CuentaCorrienteProveedor[]
}

function ComprasContent() {
    const searchParams = useSearchParams()
    const [movimientos, setMovimientos] = useState<Movimiento[]>([])
    const [insumos, setInsumos] = useState<Insumo[]>([])
    const [proveedores, setProveedores] = useState<Proveedor[]>([])
    const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
    const [cajas, setCajas] = useState<CajaCompra[]>([])
    const [cuentaCorriente, setCuentaCorriente] = useState<CuentaCorriente | null>(null)
    const [cuentasExpandidas, setCuentasExpandidas] = useState<Record<string, boolean>>({})
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showFacturaModal, setShowFacturaModal] = useState(false)
    const [editingCompraId, setEditingCompraId] = useState<string | null>(null)
    const [editingFacturaItemIndex, setEditingFacturaItemIndex] = useState<number | null>(null)
    const [loadingFactura, setLoadingFactura] = useState(false)
    const [facturaForm, setFacturaForm] = useState({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] as PagoForm[], ubicacionId: '', observaciones: '', items: [] as ItemFacturaForm[], montoPagado: '' })
    const [tempItem, setTempItem] = useState({ insumoId: '', insumoNombre: '', cantidad: '', cantidadSecundaria: '', costoTotal: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', unidadMedida: 'unidades' })
    const [mostrarTodosInsumos, setMostrarTodosInsumos] = useState(false)
    const [isManualProveedor, setIsManualProveedor] = useState(false)
    const [isManualInsumo, setIsManualInsumo] = useState(false)
    const [filterInsumo, setFilterInsumo] = useState('')
    const [filterFecha, setFilterFecha] = useState(new Date().toLocaleDateString('en-CA')) // YYYY-MM-DD local
    const [filterPago, setFilterPago] = useState('')
    const [agruparPorProveedor, setAgruparPorProveedor] = useState(false)
    const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({})
    const [editingId, setEditingId] = useState<string | null>(null)
    
    const toggleProvider = (provName: string) => {
        setExpandedProviders(prev => ({ ...prev, [provName]: !(prev[provName] ?? true) }))
    }

    const [form, setForm] = useState({
        insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '',
        costoTotal: '', estadoPago: 'pagado', actualizarCosto: true,
        montoPagado: '',
        useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'),
        fechaFactura: '',
        ubicacionId: '', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] as PagoForm[],
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const emptyTempItem = () => ({ insumoId: '', insumoNombre: '', cantidad: '', cantidadSecundaria: '', costoTotal: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', unidadMedida: 'unidades' })
    const fechaInput = (fecha: string | null | undefined) => fecha ? new Date(fecha).toLocaleDateString('en-CA') : ''

    function closeFacturaModal() {
        setShowFacturaModal(false)
        setEditingCompraId(null)
        setEditingFacturaItemIndex(null)
        setTempItem(emptyTempItem())
        setIsManualInsumo(false)
    }

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
            const [movRes, insRes, provRes, ubiRes, cajasRes, cuentaRes] = await Promise.all([
                fetch('/api/movimientos-stock?tipo=entrada&limit=500'),
                fetch('/api/insumos'),
                fetch('/api/proveedores?activos=true'),
                fetch('/api/operaciones/ubicaciones'),
                fetch('/api/compras/cajas'),
                fetch('/api/compras/cuenta-corriente'),
            ])
            const movData = await movRes.json()
            const insData = await insRes.json()
            const provData = await provRes.json()
            const ubiData = await ubiRes.json()
            const cajasData: unknown = await cajasRes.json()
            const cuentaData: unknown = await cuentaRes.json()

            setMovimientos(Array.isArray(movData) ? movData : [])
            setInsumos(Array.isArray(insData) ? insData : [])
            setProveedores(Array.isArray(provData) ? provData : [])
            setUbicaciones(Array.isArray(ubiData) ? ubiData : [])
            if (cuentaRes.ok && cuentaData && typeof cuentaData === 'object') {
                setCuentaCorriente(cuentaData as CuentaCorriente)
            }
            
            if (Array.isArray(cajasData)) {
                const list = cajasData.filter((c): c is CajaCompra => Boolean(c && typeof c === 'object' && typeof c.tipo === 'string'))
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

            if (!editingId && form.tipo === 'entrada' && (form.estadoPago === 'pagado' || form.estadoPago === 'a_cuenta') && form.pagoDividido) {
                const totalEsperado = form.estadoPago === 'a_cuenta' ? parseFloat(form.montoPagado || '0') : parseFloat(form.costoTotal || '0');
                const totalCalculado = form.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0);
                if (Math.abs(totalCalculado - totalEsperado) > 0.01) {
                    return setError('La suma de los pagos divididos debe ser exactamente igual al monto a pagar ($' + totalEsperado.toLocaleString('es-AR') + ')');
                }
            }

            if (!editingId && form.tipo === 'entrada' && form.estadoPago === 'a_cuenta') {
                const montoP = parseFloat(form.montoPagado || '0');
                const costoT = parseFloat(form.costoTotal || '0');
                if (montoP <= 0) return setError('Ingrese el monto a pagar a cuenta');
                if (montoP >= costoT) return setError('El monto a cuenta debe ser menor al costo total. Si paga todo, use "Pagado".');
            }

            const payloadParams = {
                ...cleansingForm,
                cantidad: cleansingForm.useBultos 
                    ? String(parseFloat(cleansingForm.bultos || '0') * parseFloat(cleansingForm.unidadesPorBulto || '1')) 
                    : cleansingForm.cantidad,
                montoPagado: form.montoPagado ? String(form.montoPagado).replace(',', '.') : undefined,
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
            setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', montoPagado: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), fechaFactura: '', ubicacionId: '', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] })
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
        const itemToAdd: ItemFacturaForm = {
            ...tempItem, 
            movimientoId: editingFacturaItemIndex === null ? undefined : facturaForm.items[editingFacturaItemIndex].movimientoId,
            cantidad: finalCantidad,
            insumoNombre: isManualInsumo ? tempItem.insumoNombre : (insData?.nombre || ''),
            unidadMedida: isManualInsumo ? (tempItem.unidadMedida || 'unidades') : (insData?.unidadMedida || 'u'),
            unidadSecundaria: insData?.unidadSecundaria
        }

        const items = [...facturaForm.items]
        if (editingFacturaItemIndex === null) items.push(itemToAdd)
        else items[editingFacturaItemIndex] = itemToAdd
        setFacturaForm({ ...facturaForm, items })
        setEditingFacturaItemIndex(null)
        setTempItem(emptyTempItem())
        setIsManualInsumo(false)
    }

    const editFacturaItem = (index: number) => {
        const item = facturaForm.items[index]
        setEditingFacturaItemIndex(index)
        setIsManualInsumo(!item.insumoId)
        setTempItem({
            insumoId: item.insumoId,
            insumoNombre: item.insumoNombre,
            cantidad: item.cantidad,
            cantidadSecundaria: item.cantidadSecundaria,
            costoTotal: item.costoTotal,
            actualizarCosto: item.actualizarCosto,
            useBultos: false,
            bultos: '',
            unidadesPorBulto: '',
            fechaVencimiento: item.fechaVencimiento,
            unidadMedida: item.unidadMedida,
        })
    }

    const removeFacturaItem = (index: number) => {
        const newItems = [...facturaForm.items]
        newItems.splice(index, 1)
        setFacturaForm({ ...facturaForm, items: newItems })
        if (editingFacturaItemIndex === index) {
            setEditingFacturaItemIndex(null)
            setTempItem(emptyTempItem())
        } else if (editingFacturaItemIndex !== null && editingFacturaItemIndex > index) {
            setEditingFacturaItemIndex(editingFacturaItemIndex - 1)
        }
    }

    async function handleFacturaSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!isManualProveedor && !facturaForm.proveedorId) return setError('Seleccione un proveedor')
        if (isManualProveedor && !facturaForm.proveedorNombre) return setError('Ingrese el nombre del proveedor manual')
        if (facturaForm.items.length === 0) return setError('Debe agregar al menos un insumo a la factura')
        
        if (!editingCompraId && (facturaForm.estadoPago === 'pagado' || facturaForm.estadoPago === 'a_cuenta') && facturaForm.pagoDividido) {
            const totalFactura = facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0);
            const totalEsperado = facturaForm.estadoPago === 'a_cuenta' ? parseFloat(facturaForm.montoPagado || '0') : totalFactura;
            const totalPagos = facturaForm.pagos.reduce((acc, p) => acc + parseFloat(p.monto || '0'), 0);
            if (Math.abs(totalEsperado - totalPagos) > 0.01) {
                return setError('La suma de los pagos divididos debe ser exactamente igual al monto a pagar ($' + totalEsperado.toLocaleString('es-AR') + ')');
            }
        }

        if (!editingCompraId && facturaForm.estadoPago === 'a_cuenta') {
            const totalFactura = facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0);
            const montoP = parseFloat(facturaForm.montoPagado || '0');
            if (montoP <= 0) return setError('Ingrese el monto a pagar a cuenta');
            if (montoP >= totalFactura) return setError('El monto a cuenta debe ser menor al total. Si paga todo, use "Pagado".');
        }

        try {
            const res = await fetch(editingCompraId ? `/api/compras/${editingCompraId}` : '/api/movimientos-stock/factura', {
                method: editingCompraId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(facturaForm),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            setSuccess(editingCompraId ? 'Factura actualizada correctamente' : 'Factura registrada correctamente')
            closeFacturaModal()
            setFacturaForm({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }], ubicacionId: '', observaciones: '', items: [], montoPagado: '' })
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleEditCompra(compraId: string) {
        setError('')
        setLoadingFactura(true)
        try {
            const res = await fetch(`/api/compras/${compraId}`)
            if (!res.ok) { const data = await res.json(); throw new Error(data.error) }
            const compra = await res.json() as CompraCompleta
            setEditingCompraId(compra.id)
            setEditingFacturaItemIndex(null)
            setIsManualProveedor(false)
            setIsManualInsumo(false)
            setMostrarTodosInsumos(true)
            setTempItem(emptyTempItem())
            setFacturaForm({
                proveedorId: compra.proveedor?.id || '',
                proveedorNombre: '',
                numeroFactura: compra.numeroFactura || '',
                fechaFactura: fechaInput(compra.fechaFactura),
                fechaMovimiento: fechaInput(compra.fechaMovimiento),
                estadoPago: compra.estadoPago,
                cajaOrigen: 'caja_chica',
                pagoDividido: false,
                pagos: [{ cajaOrigen: 'caja_chica', monto: '' }],
                ubicacionId: compra.ubicacion?.id || '',
                observaciones: compra.observaciones || '',
                montoPagado: String(compra.montoPagado || ''),
                items: compra.movimientosStock.map(movimiento => ({
                    movimientoId: movimiento.id,
                    insumoId: movimiento.insumo.id,
                    insumoNombre: movimiento.insumo.nombre,
                    cantidad: String(movimiento.cantidad),
                    cantidadSecundaria: movimiento.cantidadSecundaria ? String(movimiento.cantidadSecundaria) : '',
                    costoTotal: String(movimiento.costoTotal || 0),
                    actualizarCosto: false,
                    useBultos: false,
                    bultos: '',
                    unidadesPorBulto: '',
                    fechaVencimiento: fechaInput(movimiento.fechaVencimiento),
                    unidadMedida: movimiento.insumo.unidadMedida,
                    unidadSecundaria: movimiento.insumo.unidadSecundaria || undefined,
                })),
            })
            setShowFacturaModal(true)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al cargar la factura')
        } finally {
            setLoadingFactura(false)
        }
    }

    async function handlePago(id: string, esParcial = false) {
        if (cajas.length === 0) return setError('No hay cajas disponibles para realizar el pago')
        
        const mov = movimientos.find(m => m.id === id)
        const saldoPendiente = mov
            ? (mov.compra?.costoTotal ?? mov.costoTotal ?? 0) - (mov.compra?.montoPagado ?? mov.montoPagado ?? 0)
            : 0
        
        let montoPago: number | null = null
        if (esParcial) {
            const montoStr = prompt(`Saldo pendiente: $${saldoPendiente.toLocaleString('es-AR')}\n\n¿Cuánto abonás ahora?`, String(saldoPendiente))
            if (!montoStr) return
            montoPago = parseFloat(montoStr.replace(',', '.'))
            if (isNaN(montoPago) || montoPago <= 0) return setError('Monto inválido')
            if (montoPago > saldoPendiente + 0.01) return setError('El monto supera el saldo pendiente')
        }

        const opcionesStr = cajas.map((c, i) => `${i + 1} = ${c.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}`).join('\n')
        const resp = prompt(`¿De qué caja sale el pago?\n\n${opcionesStr}\n\nIngresá el número:`, '1')
        if (!resp) return
        
        const idx = parseInt(resp.trim()) - 1
        if (isNaN(idx) || idx < 0 || idx >= cajas.length) return setError('Opción inválida')
        
        const selectedBox = cajas[idx]
        const label = selectedBox.tipo.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        const montoLabel = montoPago ? `$${montoPago.toLocaleString('es-AR')}` : `$${saldoPendiente.toLocaleString('es-AR')} (total pendiente)`
        
        if (!confirm(`¿Registrar pago de ${montoLabel} desde ${label}?`)) return
        try {
            const payload: Record<string, string | number> = { cajaOrigen: selectedBox.tipo }
            if (montoPago !== null) payload.monto = montoPago
            
            const res = await fetch(`/api/movimientos-stock/${id}/pago`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al pagar la compra')
            }
            setSuccess(montoPago && montoPago < saldoPendiente ? 'Pago a cuenta registrado.' : 'Compra registrada como pagada.')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro que querés eliminar esta compra completa? Se revertirán todos sus ítems, pagos y saldos de caja.')) return
        try {
            const res = await fetch(`/api/movimientos-stock/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al eliminar el movimiento')
            }
            setSuccess('Compra eliminada; stock y caja fueron revertidos.')
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
    const estadoCompra = (mov: Movimiento) => mov.compra?.estadoPago || mov.estadoPago
    const filteredByPago = filterPago === 'pendiente' 
        ? filteredByInsumo.filter(m => estadoCompra(m) === 'pendiente' || estadoCompra(m) === 'a_cuenta')
        : (filterPago ? filteredByInsumo.filter(m => estadoCompra(m) === filterPago) : filteredByInsumo)
    const filtered = filteredByPago

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

    const renderRow = (mov: Movimiento) => {
        const estadoPago = estadoCompra(mov)
        const montoPagado = mov.compra?.montoPagado ?? mov.montoPagado ?? 0
        const costoCompra = mov.compra?.costoTotal ?? mov.costoTotal ?? 0
        return (
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
                        {!mov.compra ? (
                            <span className="badge" title="Factura histórica de solo lectura" style={{ backgroundColor: '#F2F3F4', color: '#616A6B', border: '1px solid #AAB7B8', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                🔒 {estadoPago === 'pagado' ? 'Pagado histórico' : estadoPago === 'a_cuenta' ? 'A cuenta histórico' : 'Pendiente histórico'}
                            </span>
                        ) : estadoPago === 'pendiente' ? (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                <button onClick={() => handlePago(mov.id)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#F39C1220', color: '#E67E22', border: '1px solid #F39C12', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                    ⏳ Pagar todo
                                </button>
                                <button onClick={() => handlePago(mov.id, true)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#3498DB20', color: '#2980B9', border: '1px solid #3498DB', alignSelf: 'flex-start', padding: '0.2rem 0.6rem' }}>
                                    💰 A cuenta
                                </button>
                            </div>
                        ) : estadoPago === 'a_cuenta' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span className="badge" style={{ backgroundColor: '#3498DB20', color: '#2980B9', border: '1px solid #3498DB', padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>
                                    💰 Pagado ${montoPagado.toLocaleString('es-AR')} / ${costoCompra.toLocaleString('es-AR')}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handlePago(mov.id)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#27AE6020', color: '#27AE60', border: '1px solid #27AE60', padding: '0.15rem 0.5rem', fontSize: '0.65rem' }}>
                                        ✅ Completar
                                    </button>
                                    <button onClick={() => handlePago(mov.id, true)} className="badge" style={{ cursor: 'pointer', backgroundColor: '#3498DB20', color: '#2980B9', border: '1px solid #3498DB', padding: '0.15rem 0.5rem', fontSize: '0.65rem' }}>
                                        + Abonar
                                    </button>
                                </div>
                            </div>
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
            <td className="hidden-mobile">
                <div>{new Date(mov.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                {mov.fechaFactura && (
                    <div style={{ fontSize: '10px', color: '#8E44AD', fontWeight: 600 }}>📄 FC: {new Date(mov.fechaFactura).toLocaleDateString('es-AR')}</div>
                )}
            </td>
            <td className="hidden-mobile">
                {mov.proveedor?.nombre || '—'}
                {mov.numeroFactura && <div style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>Fac: {mov.numeroFactura}</div>}
            </td>
            <td className="hidden-mobile" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.observaciones || '—'}</td>
            <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    {mov.compra ? (
                        <>
                            <button
                                onClick={() => handleEditCompra(mov.compra!.id)}
                                className="btn btn-icon btn-ghost"
                                style={{ color: 'var(--color-primary)' }}
                                title="Editar factura completa"
                                disabled={loadingFactura}
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => handleDelete(mov.id)}
                                className="btn btn-icon btn-ghost"
                                style={{ color: '#E74C3C' }}
                                title="Eliminar factura completa"
                            >
                                🗑️
                            </button>
                        </>
                    ) : (
                        <span title="Factura histórica de solo lectura" style={{ padding: '6px', color: 'var(--color-gray-500)' }}>🔒</span>
                    )}
                </div>
            </td>
        </tr>
        )
    }

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Cargando stock...</p></div>

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>🛒 Gestión de Compras</h1>
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
                        const defaultUbi = ubicaciones.length > 0 ? ubicaciones[0].id : ''
                        setEditingCompraId(null)
                        setEditingFacturaItemIndex(null)
                        setFacturaForm({ proveedorId: '', proveedorNombre: '', numeroFactura: '', fechaFactura: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), estadoPago: 'pagado', cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }], ubicacionId: defaultUbi, observaciones: '', items: [], montoPagado: '' })
                        setTempItem(emptyTempItem())
                        setMostrarTodosInsumos(false)
                        setIsManualProveedor(false)
                        setIsManualInsumo(false)
                        setShowFacturaModal(true)
                    }}>📑 Factura Múltiple</button>
                    <button className="btn btn-primary" onClick={() => {
                        setEditingId(null)
                        const defaultUbi = ubicaciones.length > 0 ? ubicaciones[0].id : ''
                        setForm({ insumoId: '', tipo: 'entrada', cantidad: '', cantidadSecundaria: '', observaciones: '', proveedorId: '', costoTotal: '', estadoPago: 'pagado', montoPagado: '', actualizarCosto: true, useBultos: false, bultos: '', unidadesPorBulto: '', fechaVencimiento: '', fechaMovimiento: new Date().toLocaleDateString('en-CA'), fechaFactura: '', ubicacionId: defaultUbi, cajaOrigen: 'caja_chica', pagoDividido: false, pagos: [{ cajaOrigen: 'caja_chica', monto: '' }] })
                        setShowModal(true)
                    }}>➕ Ajuste Manual</button>
                </div>
            </div>

            {success && <div className="toast toast-success">{success}</div>}
            {error && <div className="toast toast-error">{error}</div>}

            {cuentaCorriente && (
                <section className="card" style={{ marginBottom: 'var(--space-6)', overflow: 'hidden' }}>
                    <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', background: '#FFF8E7', borderBottom: '1px solid #F5D98B' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>🏦 Cuenta corriente de proveedores</h2>
                            <p style={{ margin: '4px 0 0', color: 'var(--color-gray-500)', fontSize: 'var(--text-sm)' }}>Saldos reales de facturas pendientes y pagos a cuenta. No depende del filtro de fecha del historial.</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)', textTransform: 'uppercase', fontWeight: 700 }}>Total pendiente</div>
                            <div style={{ fontSize: '1.8rem', color: '#C0392B', fontWeight: 800 }}>${cuentaCorriente.totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-500)' }}>{cuentaCorriente.cantidadFacturas} factura{cuentaCorriente.cantidadFacturas === 1 ? '' : 's'} · {cuentaCorriente.cantidadProveedores} proveedor{cuentaCorriente.cantidadProveedores === 1 ? '' : 'es'}</div>
                        </div>
                    </div>

                    {cuentaCorriente.proveedores.length === 0 ? (
                        <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>✅ No hay saldos pendientes con proveedores.</div>
                    ) : (
                        <div className="table-container" style={{ border: 0, borderRadius: 0 }}>
                            <table className="table" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Proveedor</th>
                                        <th>Facturas impagas</th>
                                        <th>Total facturado</th>
                                        <th>Pagado</th>
                                        <th>Saldo pendiente</th>
                                        <th>Más antigua</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cuentaCorriente.proveedores.map((proveedor) => {
                                        const clave = proveedor.proveedorId || proveedor.proveedorNombre
                                        const expandida = cuentasExpandidas[clave] || false
                                        return (
                                            <Fragment key={clave}>
                                                <tr>
                                                    <td style={{ fontWeight: 700 }}>{proveedor.proveedorNombre}</td>
                                                    <td>{proveedor.cantidadFacturas}</td>
                                                    <td>${proveedor.totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ color: proveedor.totalPagado > 0 ? 'var(--color-success)' : 'var(--color-gray-500)' }}>${proveedor.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ color: '#C0392B', fontWeight: 800 }}>${proveedor.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                                    <td>{proveedor.fechaMasAntigua ? new Date(proveedor.fechaMasAntigua).toLocaleDateString('es-AR') : '—'}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCuentasExpandidas(actual => ({ ...actual, [clave]: !expandida }))}>
                                                            {expandida ? 'Ocultar' : 'Ver facturas'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandida && (
                                                    <tr style={{ background: '#FAFAFA' }}>
                                                        <td colSpan={7} style={{ padding: 'var(--space-3) var(--space-5)' }}>
                                                            <div style={{ display: 'grid', gap: '8px' }}>
                                                                {proveedor.facturas.map(factura => (
                                                                    <div key={`${factura.origen}-${factura.id}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) minmax(90px, 0.8fr) repeat(3, minmax(110px, 1fr))', gap: 'var(--space-3)', alignItems: 'center', padding: '8px 10px', background: '#fff', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-sm)' }}>
                                                                        <strong>Fac. {factura.numeroFactura || 'S/N'}</strong>
                                                                        <span>{new Date(factura.fecha).toLocaleDateString('es-AR')}</span>
                                                                        <span>Total: ${factura.costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                                        <span>Pagado: ${factura.montoPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                                                        <strong style={{ color: '#C0392B' }}>Debe: ${factura.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800 }}>Totales:</td>
                                        <td style={{ fontWeight: 800 }}>${cuentaCorriente.totalFacturado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        <td style={{ fontWeight: 800 }}>${cuentaCorriente.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        <td style={{ color: '#C0392B', fontWeight: 900 }}>${cuentaCorriente.totalPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </section>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>📜 Historial de Compras y Ajustes</h2>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>

                <button className="btn btn-sm" onClick={() => setFilterPago(filterPago === 'pendiente' ? '' : 'pendiente')}
                    style={{ whiteSpace: 'nowrap', backgroundColor: filterPago === 'pendiente' ? '#E67E22' : '#E67E2218', color: filterPago === 'pendiente' ? '#fff' : '#E67E22', border: '2px solid #E67E22', fontWeight: 600 }}>
                    ⏳ Pagos Pendientes ({new Set(movimientosPorFecha.filter(m => estadoCompra(m) === 'pendiente' || estadoCompra(m) === 'a_cuenta').map(m => m.compra?.id || m.id)).size})
                </button>
                <button className="btn btn-sm" onClick={() => setAgruparPorProveedor(!agruparPorProveedor)}
                    style={{ whiteSpace: 'nowrap', backgroundColor: agruparPorProveedor ? '#9B59B6' : '#9B59B618', color: agruparPorProveedor ? '#fff' : '#9B59B6', border: '2px solid #9B59B6', fontWeight: 600 }}>
                    🏢 {agruparPorProveedor ? 'Desagrupar Proveedor' : 'Agrupar por Proveedor'}
                </button>
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
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>No hay movimientos registrados</td></tr>
                        ) : agruparPorProveedor ? (() => {
                            const groups: Record<string, typeof filtered> = {};
                            filtered.forEach(mov => {
                                const provName = mov.proveedor?.nombre || 'Sin Proveedor';
                                if (!groups[provName]) groups[provName] = [];
                                groups[provName].push(mov);
                            });
                            return Object.entries(groups).map(([provName, movs]) => {
                                const isExpanded = expandedProviders[provName] ?? true;
                                return (
                                <Fragment key={provName}>
                                    <tr style={{ backgroundColor: '#F8F9FA', cursor: 'pointer' }} onClick={() => toggleProvider(provName)}>
                                        <td colSpan={9} style={{ fontWeight: 700, padding: '1rem', borderBottom: '2px solid #E5E7E9', userSelect: 'none' }}>
                                            {isExpanded ? '🔽' : '▶️'} 🏢 {provName} <span className="badge badge-secondary" style={{ marginLeft: '8px', opacity: 0.8 }}>{movs.length} items</span>
                                        </td>
                                    </tr>
                                    {isExpanded && movs.map(renderRow)}
                                </Fragment>
                                );
                            });
                        })() : filtered.map(renderRow)}
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
                                        {insumos.map((ins) => {
                                            const stockUbi = form.ubicacionId ? ins.stocks?.find((s) => s.ubicacionId === form.ubicacionId)?.cantidad || 0 : ins.stockActual;
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
                                    {form.tipo === 'entrada' && (
                                        <div className="form-group">
                                            <label className="form-label">Fecha Factura/Remito</label>
                                            <input type="date" className="form-input" value={form.fechaFactura} onChange={(e) => setForm({ ...form, fechaFactura: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} />
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
                                            <select className="form-select" value={form.estadoPago} disabled={!!editingId} onChange={(e) => setForm({ ...form, estadoPago: e.target.value })}>
                                                <option value="pagado">✅ Pagado (Contado)</option>
                                                <option value="a_cuenta">💰 A Cuenta (Parcial)</option>
                                                <option value="pendiente">⏳ Pendiente (Cta. Cte.)</option>
                                            </select>
                                        </div>
                                        {form.estadoPago === 'a_cuenta' && (
                                            <div className="form-group">
                                                <label className="form-label">Monto que abona ahora ($)</label>
                                                <input type="number" step="0.01" className="form-input" 
                                                    value={form.montoPagado || ''}
                                                    onChange={(e) => setForm({ ...form, montoPagado: e.target.value })}
                                                    placeholder="Ej: 50000" 
                                                    required 
                                                />
                                                {form.montoPagado && form.costoTotal && (
                                                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#2980B9' }}>
                                                        Quedará pendiente: <strong>${(parseFloat(form.costoTotal) - parseFloat(form.montoPagado || '0')).toLocaleString('es-AR')}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
                                                <input type="checkbox" checked={form.actualizarCosto} onChange={(e) => setForm({ ...form, actualizarCosto: e.target.checked })} />
                                                Actualizar costo unitario del insumo
                                            </label>
                                        </div>
                                        {!editingId && (form.estadoPago === 'pagado' || form.estadoPago === 'a_cuenta') && (
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
                <div className="modal-overlay" onClick={closeFacturaModal}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
                        <div className="modal-header">
                            <h2>📑 {editingCompraId ? 'Editar Factura Completa' : 'Registrar Factura Múltiple'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={closeFacturaModal}>✕</button>
                        </div>
                        <form onSubmit={handleFacturaSubmit}>
                            <div className="modal-body">
                                {editingCompraId && (
                                    <div style={{ padding: '10px 12px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)', backgroundColor: '#EBF5FB', color: '#21618C', fontSize: '0.85rem' }}>
                                        Podés modificar la cabecera y todos los ítems en una sola operación. Los pagos ya registrados se conservan; el total nuevo no puede quedar por debajo de los <strong>${Number(facturaForm.montoPagado || 0).toLocaleString('es-AR')}</strong> abonados.
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
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
                                    <div className="form-group">
                                        <label className="form-label">Fecha Factura/Remito</label>
                                        <input type="date" className="form-input" value={facturaForm.fechaFactura} onChange={(e) => setFacturaForm({ ...facturaForm, fechaFactura: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Estado de Pago</label>
                                        <select className="form-select" value={facturaForm.estadoPago} disabled={!!editingCompraId} onChange={(e) => setFacturaForm({ ...facturaForm, estadoPago: e.target.value })}>
                                            <option value="pagado">✅ Pagado (Contado)</option>
                                            <option value="a_cuenta">💰 A Cuenta (Parcial)</option>
                                            <option value="pendiente">⏳ Pendiente (Cta. Cte.)</option>
                                        </select>
                                    </div>
                                    {!editingCompraId && facturaForm.estadoPago === 'a_cuenta' && (
                                        <div className="form-group">
                                            <label className="form-label">Monto a pagar ahora ($)</label>
                                            <input type="number" step="0.01" className="form-input" 
                                                value={facturaForm.montoPagado} 
                                                onChange={(e) => setFacturaForm({ ...facturaForm, montoPagado: e.target.value })} 
                                                placeholder="Ej: 50000" required />
                                            {facturaForm.montoPagado && facturaForm.items.length > 0 && (
                                                <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#2980B9' }}>
                                                    Quedará pendiente: <strong>${(facturaForm.items.reduce((acc, it) => acc + parseFloat(it.costoTotal || '0'), 0) - parseFloat(facturaForm.montoPagado || '0')).toLocaleString('es-AR')}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label">Fecha del Movimiento</label>
                                        <input type="date" className="form-input" value={facturaForm.fechaMovimiento} onChange={(e) => setFacturaForm({ ...facturaForm, fechaMovimiento: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} required />
                                    </div>
                                    {!editingCompraId && (facturaForm.estadoPago === 'pagado' || facturaForm.estadoPago === 'a_cuenta') && (
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

                                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                                    <label className="form-label">Observaciones de la factura</label>
                                    <input className="form-input" value={facturaForm.observaciones} onChange={(e) => setFacturaForm({ ...facturaForm, observaciones: e.target.value })} placeholder="Opcional" />
                                </div>

                                <hr style={{ margin: 'var(--space-4) 0' }} />

                                {/* Seleccion de Insumos */}
                                <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-2)' }}>🛒 {editingFacturaItemIndex === null ? 'Agregar insumo a la factura' : 'Editar ítem de la factura'}</h3>
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
                                                            setTempItem({ ...tempItem, insumoId: '', insumoNombre: '', unidadMedida: 'unidades' })
                                                        }} />
                                                        Manual
                                                    </label>
                                                </div>
                                            </div>
                                            {isManualInsumo ? (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input className="form-input" style={{ flex: 2 }} placeholder="Nombre (Ej: Escoba)" value={tempItem.insumoNombre || ''} onChange={(e) => setTempItem({ ...tempItem, insumoNombre: e.target.value })} />
                                                    <select className="form-select" style={{ flex: 1 }} value={tempItem.unidadMedida || 'unidades'} onChange={(e) => setTempItem({ ...tempItem, unidadMedida: e.target.value })}>
                                                        <option value="unidades">unidades</option>
                                                        <option value="kg">kg</option>
                                                        <option value="g">g</option>
                                                        <option value="L">L</option>
                                                        <option value="ml">ml</option>
                                                        <option value="m">m</option>
                                                        <option value="m2">m2</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <select className="form-select" value={tempItem.insumoId} onChange={(e) => {
                                                    const id = e.target.value;
                                                    const ins = insumos.find(i => i.id === id);
                                                    setTempItem({ ...tempItem, insumoId: id, useBultos: false, bultos: '', unidadesPorBulto: '', cantidad: '', cantidadSecundaria: '', unidadMedida: ins?.unidadMedida || 'unidades' });
                                                }}>
                                                    <option value="">Seleccionar insumo...</option>
                                                    {insumos.filter(i => mostrarTodosInsumos || !facturaForm.proveedorId || i.proveedor?.id === facturaForm.proveedorId || i.proveedores?.some(item => item.proveedor.id === facturaForm.proveedorId)).map((ins) => (
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
                                                        Cant. ({!isManualInsumo && tempItem.insumoId ? insumos.find(i => i.id === tempItem.insumoId)?.unidadMedida : (tempItem.unidadMedida || 'unidades')})
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

                                    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.7rem', margin: 0 }}>Vencimiento del ítem</label>
                                            <input type="date" className="form-input" value={tempItem.fechaVencimiento} onChange={(e) => setTempItem({ ...tempItem, fechaVencimiento: e.target.value })} onClick={(e) => e.currentTarget.showPicker?.()} />
                                        </div>
                                        {!isManualInsumo && (
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--color-gray-600)', paddingBottom: '8px' }}>
                                                <input type="checkbox" checked={tempItem.actualizarCosto} onChange={(e) => setTempItem({ ...tempItem, actualizarCosto: e.target.checked })} />
                                                Actualizar costo unitario del insumo al guardar
                                            </label>
                                        )}
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {editingFacturaItemIndex !== null && (
                                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => {
                                                    setEditingFacturaItemIndex(null)
                                                    setTempItem(emptyTempItem())
                                                    setIsManualInsumo(false)
                                                }}>Cancelar edición</button>
                                            )}
                                            <button type="button" className="btn btn-sm btn-ghost" onClick={addItemToFactura} style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '4px 12px' }}>
                                                {editingFacturaItemIndex === null ? '+ Agregar a Factura' : 'Guardar ítem'}
                                            </button>
                                        </div>
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
                                                    <tr key={it.movimientoId || idx} style={editingFacturaItemIndex === idx ? { backgroundColor: '#EBF5FB' } : undefined}>
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
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button type="button" className="btn btn-icon btn-ghost" title="Editar ítem" onClick={() => editFacturaItem(idx)} style={{ color: 'var(--color-primary)' }}>✏️</button>
                                                                <button type="button" className="btn btn-icon btn-ghost" title="Quitar ítem" onClick={() => removeFacturaItem(idx)} style={{ color: 'var(--color-danger)' }}>✕</button>
                                                            </div>
                                                        </td>
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
                                <button type="button" className="btn btn-ghost" onClick={closeFacturaModal}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">{editingCompraId ? 'Guardar Factura Completa' : 'Registrar Factura Completa'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ComprasPage() {
    return (
        <Suspense fallback={<div className="empty-state"><div className="spinner" /><p>Cargando compras...</p></div>}>
            <ComprasContent />
        </Suspense>
    )
}
