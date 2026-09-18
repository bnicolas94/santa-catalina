'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import useSWR from 'swr'

interface CajaCatalogo { id: string; tipo: string; nombre: string | null; saldo: number; activo: boolean; ubicacionId: string | null; ubicacion: { nombre: string; activo: boolean; tipo?: string } | null; recibeDepositos: boolean }

interface UsuarioCaja {
    id: string
    nombre: string
    apellido: string | null
}

interface AuditoriaCaja {
    id: string
    accion: string
    motivo: string | null
    createdAt: string
    valoresAnteriores: Record<string, unknown> | null
    valoresNuevos: Record<string, unknown> | null
    usuario: UsuarioCaja | null
}

interface MovCaja {
    id: string; tipo: string; concepto: string; monto: number; medioPago: string
    cajaOrigen: string | null; descripcion: string | null; fecha: string
    pedido: { id: string; totalImporte: number; cliente: { nombreComercial: string } } | null
    rendicion: { id: string; chofer: { id: string, nombre: string } } | null
    movimientoMp?: { mpId: string; comisionMp: number; montoNeto: number; estado: string; metodoPago: string | null } | null
    gestionadoPorRRHH?: boolean
    gestionadoPorDeposito?: boolean
    estado: string
    createdAt: string
    anuladoAt: string | null
    motivoAnulacion: string | null
    creadoPor: UsuarioCaja | null
    actualizadoPor: UsuarioCaja | null
    anuladoPor: UsuarioCaja | null
    auditorias?: AuditoriaCaja[]
}

interface PendingPedido {
    id: string
    entregaId: string
    clienteNombre: string
    totalImporte: number
    totalUnidades: number
}

interface Rendicion {
    rutaId: string
    fecha: string
    turno: string | null
    choferId: string; choferNombre: string; montoEsperado: number
    pedidosEfectivo: number; bloqueada: boolean; pedidos: PendingPedido[]
}

interface DepositoCaja {
    id: string
    fecha: string
    montoDeclarado: number
    montoReal: number | null
    diferencia: number | null
    estado: string
    cajaOrigen: string
    cajaRecepcion: string | null
    cajaDestino: string | null
    concepto: string
    observaciones: string | null
    declaradoPor: UsuarioCaja
    validadoPor: UsuarioCaja | null
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

function nombreUsuario(usuario: UsuarioCaja | null | undefined) {
    if (!usuario) return 'Sistema'
    return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ')
}

const etiquetasAuditoria: Record<string, string> = {
    tipo: 'Tipo',
    concepto: 'Concepto',
    monto: 'Monto',
    medioPago: 'Medio de pago',
    cajaOrigen: 'Caja',
    descripcion: 'Descripción',
    fecha: 'Fecha',
    estado: 'Estado',
    saldoDisponible: 'Saldo disponible',
    montoDeclarado: 'Monto autorizado',
    saldoResultante: 'Saldo resultante',
}

interface ConfigDeposito {
    cajaOrigenId: string
    cajaRecepcionId: string
    conceptoDeposito: string
    habilitarDeposito: boolean
}

const accionesAuditoria: Record<string, string> = {
    CREACION: 'Creación',
    MODIFICACION: 'Modificación',
    ANULACION: 'Anulación',
    REASIGNACION: 'Reasignación',
    AUTORIZACION_EXCESO_DEPOSITO: 'Autorización de depósito excedido',
}

function valorAuditoria(clave: string, valor: unknown) {
    if (valor === null || valor === undefined || valor === '') return '—'
    if (['monto', 'saldoDisponible', 'montoDeclarado', 'saldoResultante'].includes(clave) && typeof valor === 'number') return formatCurrency(valor)
    if (clave === 'fecha' && typeof valor === 'string') return new Date(valor).toLocaleString('es-AR')
    return String(valor)
}

function cambiosAuditoria(auditoria: AuditoriaCaja) {
    const anteriores = auditoria.valoresAnteriores || {}
    const nuevos = auditoria.valoresNuevos || {}
    return Object.keys({ ...anteriores, ...nuevos })
        .filter(clave => JSON.stringify(anteriores[clave]) !== JSON.stringify(nuevos[clave]))
        .map(clave => ({
            clave,
            anterior: anteriores[clave],
            nuevo: nuevos[clave],
        }))
}

const cajaFetcher = async ([_, fecha]: [string, string]) => {
    const [cajaRes, rendRes, saldosRes, conceptosRes, empRes, depositosRes] = await Promise.all([
        fetch(`/api/caja?fecha=${fecha}`),
        fetch('/api/caja/rendiciones'),
        fetch('/api/caja/saldos'),
        fetch('/api/caja/conceptos'),
        fetch('/api/operaciones/empleados'),
        fetch('/api/caja/depositos')
    ])
    
    return {
        cajaData: await cajaRes.json(),
        rendicionesData: await rendRes.json(),
        saldosData: await saldosRes.json(),
        conceptosData: await conceptosRes.json(),
        empleadosData: await empRes.json(),
        depositosData: await depositosRes.json()
    }
}

export default function CajaPage() {
    const { data: session } = useSession()
    const userRol = (session?.user as any)?.rol
    const ubicacionTipo = (session?.user as any)?.ubicacionTipo
    const ubicacionId = (session?.user as { ubicacionId?: string })?.ubicacionId

    const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])

    const { data: swrData, isLoading: loading, mutate } = useSWR(['caja-data', fechaFiltro], cajaFetcher, {
        refreshInterval: 15000,
        revalidateOnFocus: true
    })
    const fetchData = () => mutate()

    const movimientos = swrData?.cajaData?.movimientos || []
    const resumen = swrData?.cajaData?.resumen || { ingresosEfectivo: 0, ingresosTransferencia: 0, egresosTotal: 0, saldo: 0 }
    
    const rendDataRaw = swrData?.rendicionesData
    const rendiciones = Array.isArray(rendDataRaw) ? rendDataRaw.filter((r: Rendicion) => r.montoEsperado > 0) : []
    const depositosPendientes: DepositoCaja[] = Array.isArray(swrData?.depositosData) ? swrData.depositosData : []

    const saldosData = swrData?.saldosData || {}
    const cajasCatalogo: CajaCatalogo[] = Array.isArray(saldosData.cajas) ? saldosData.cajas : []
    const cajasActivas = cajasCatalogo.filter(c => c.activo && (!c.ubicacion || c.ubicacion.activo))

    const conceptosData = swrData?.conceptosData
    const conceptos = Array.isArray(conceptosData) ? conceptosData : []

    const empData = swrData?.empleadosData
    const choferes = Array.isArray(empData) ? empData : []
    const [editingSaldo, setEditingSaldo] = useState<string | null>(null)
    const [editSaldoValue, setEditSaldoValue] = useState('')
    const [editMotivo, setEditMotivo] = useState('ajuste')
    const [editDescripcion, setEditDescripcion] = useState('')
    const [toastNotif, setToastNotif] = useState<{ message: string, amount: number, id: string } | null>(null)
    const [selectedDepositTarget, setSelectedDepositTarget] = useState('')
    const movimientosRef = useRef<MovCaja[]>([])

    const getBoxLabel = (id: string | null | undefined) => {
        if (!id) return '-';
        const caja = cajasCatalogo.find(c => c.tipo === id)
        return caja ? (caja.nombre || caja.tipo) + (caja.ubicacion ? ' · ' + caja.ubicacion.nombre : '') : id.replace(/_/g, ' ')
    };


    const [showMontos, setShowMontos] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transfForm, setTransfForm] = useState({ origen: 'local', destino: 'caja_chica', monto: '', fecha: new Date().toISOString().split('T')[0] })
    const [showRendicionModal, setShowRendicionModal] = useState<Rendicion | null>(null)
    const [form, setForm] = useState({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: '', choferId: '', fecha: new Date().toISOString().split('T')[0] })
    const [rendForm, setRendForm] = useState({ montoEntregado: '', observaciones: '' })
    const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null)
    const [editingPedidoPrice, setEditingPedidoPrice] = useState<string>('')
    const [updatingPedidoId, setUpdatingPedidoId] = useState<string | null>(null)

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [showConceptosModal, setShowConceptosModal] = useState(false)
    const [nuevoConcepto, setNuevoConcepto] = useState('')
    const [editingMov, setEditingMov] = useState<MovCaja | null>(null)
    const [auditMov, setAuditMov] = useState<MovCaja | null>(null)
    const [showDepositModal, setShowDepositModal] = useState(false)
    const [depositAmount, setDepositAmount] = useState('')
    const [depositAdminAuth, setDepositAdminAuth] = useState({ usuario: '', password: '' })
    const [showValidacionDeposito, setShowValidacionDeposito] = useState<DepositoCaja | null>(null)
    const [validacionDepositoForm, setValidacionDepositoForm] = useState({ montoReal: '', cajaDestino: 'caja_chica', observaciones: '', fecha: new Date().toISOString().split('T')[0] })
    const [depositConfig, setDepositConfig] = useState<ConfigDeposito | null>(null)
    const [filtroTexto, setFiltroTexto] = useState('')
    const [filtroCaja, setFiltroCaja] = useState('todas')
    const [filtroTipo, setFiltroTipo] = useState('todos')

    const allowedBoxes = cajasActivas.map(c => c.tipo)
    const cajasOrigenDeposito = cajasActivas.filter(caja =>
        Boolean(caja.ubicacionId)
        && !caja.recibeDepositos
        && cajasActivas.some(destino => destino.ubicacionId === caja.ubicacionId && destino.recibeDepositos)
    )
    const cajasPorSucursal = [...cajasActivas.reduce((grupos, caja) => {
        const clave = caja.ubicacionId || '__sin_sede__'
        const grupo = grupos.get(clave) || {
            clave,
            nombre: caja.ubicacion?.nombre || 'Sin sede',
            tipo: caja.ubicacion?.tipo || 'OTRA',
            cajas: [] as CajaCatalogo[],
            total: 0,
        }
        grupo.cajas.push(caja)
        grupo.cajas.sort((a, b) => {
            const orden = (nombre: string | null) => {
                const valor = (nombre || '').toLocaleLowerCase('es')
                if (valor.includes('chica')) return 0
                if (valor.includes('fuerte')) return 1
                return 2
            }

            return orden(a.nombre) - orden(b.nombre)
                || (a.nombre || a.tipo).localeCompare(b.nombre || b.tipo, 'es')
        })
        grupo.total += caja.saldo
        grupos.set(clave, grupo)
        return grupos
    }, new Map<string, { clave: string; nombre: string; tipo: string; cajas: CajaCatalogo[]; total: number }>()).values()]
        .sort((a, b) => {
            const orden = (tipo: string) => tipo === 'FABRICA' ? 0 : tipo === 'LOCAL' ? 1 : 2
            return orden(a.tipo) - orden(b.tipo) || a.nombre.localeCompare(b.nombre, 'es')
        })
    const getBoxSaldo = (tipo: string) => cajasCatalogo.find(c => c.tipo === tipo)?.saldo ?? 0
    const cajaDepositoSeleccionada = userRol === 'ADMIN' ? selectedDepositTarget : depositConfig?.cajaOrigenId
    const cajaOrigenSeleccionada = cajasActivas.find(caja => caja.tipo === cajaDepositoSeleccionada)
    const cajaRecepcionSeleccionada = cajasActivas.find(caja =>
        caja.recibeDepositos && caja.ubicacionId === cajaOrigenSeleccionada?.ubicacionId
    )
    const saldoDisponibleDeposito = cajaDepositoSeleccionada ? getBoxSaldo(cajaDepositoSeleccionada) : 0
    const montoDeposito = Number(depositAmount)
    const depositoRequiereAdmin = depositAmount !== '' && Number.isFinite(montoDeposito)
        && montoDeposito > Math.max(0, saldoDisponibleDeposito)
    const defaultBox = allowedBoxes.find(k => k !== depositConfig?.cajaOrigenId) || allowedBoxes[0] || ''

    const movimientosFiltrados = movimientos.filter((m: MovCaja) => {
        // Filtro por Tipo
        if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;

        // Filtro por Caja
        if (filtroCaja !== 'todas' && m.cajaOrigen !== filtroCaja) return false;

        // Filtro por Texto (Concepto, Descripción, Chofer, Pedido)
        if (filtroTexto.trim() !== '') {
            const search = filtroTexto.toLowerCase();
            const conceptoStr = (conceptos.find(c => c.clave === m.concepto)?.nombre || m.concepto || '').toLowerCase();
            const descStr = (m.descripcion || '').toLowerCase();
            const choferStr = (m.rendicion?.chofer?.nombre || '').toLowerCase();
            const pedidoStr = (m.pedido?.cliente?.nombreComercial || '').toLowerCase();

            return conceptoStr.includes(search) || descStr.includes(search) || choferStr.includes(search) || pedidoStr.includes(search);
        }

        return true;
    });

    const cajasDisponiblesKey = allowedBoxes.join('|')
    useEffect(() => {
        const cajas = cajasDisponiblesKey ? cajasDisponiblesKey.split('|') : []
        setForm(f => cajas.includes(f.cajaOrigen) ? f : { ...f, cajaOrigen: cajas[0] || '' })
        setTransfForm(f => ({ ...f, origen: cajas.includes(f.origen) ? f.origen : cajas[0] || '', destino: cajas.includes(f.destino) ? f.destino : cajas[1] || '' }))
    }, [cajasDisponiblesKey])

    useEffect(() => { 
        // Solicitar permisos de notificación de escritorio
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, [])

    useEffect(() => {
        fetchData()
        if (userRol) {
            fetchDepositConfig()
        }
    }, [fechaFiltro, userRol, ubicacionId])

    const fetchDepositConfig = async () => {
        try {
            const res = await fetch('/api/caja/config-deposito')
            const data = await res.json()
            if (userRol === 'ADMIN') {
                // Usar la sede del administrador o la primera sede con depósitos habilitados
                const safeTarget = ubicacionId && data[ubicacionId] ? ubicacionId : Object.keys(data)[0]
                setDepositConfig(data[safeTarget])
            } else {
                setDepositConfig(data)
            }
        } catch (err) {
            console.error('Error fetching deposit config:', err)
        }
    }

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
            setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: defaultBox, choferId: '', fecha: new Date().toISOString().split('T')[0] })
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
            setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: defaultBox, choferId: '', fecha: new Date().toISOString().split('T')[0] })

            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error') }
    }

    async function handleDelete(id: string) {
        const motivo = prompt('Indicá el motivo de la anulación (mínimo 5 caracteres):')
        if (motivo === null) return
        try {
            const res = await fetch(`/api/caja?id=${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Error al anular')
            }
            setSuccess('Movimiento anulado; se conservó en el historial')
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al anular')
        }
    }

    function startEdit(m: MovCaja) {
        setEditingMov(m)
        const isMP = m.cajaOrigen === 'mercado_pago' || m.cajaOrigen === 'mercado_pago_juani';
        setForm({
            tipo: m.tipo,
            concepto: m.concepto,
            monto: String(m.monto),
            medioPago: isMP ? 'transferencia' : m.medioPago,
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
                    rutaId: showRendicionModal.rutaId,
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
    
    async function handleSavePrice(pedidoId: string) {
        if (!editingPedidoPrice) return
        const price = Math.round(parseFloat(editingPedidoPrice))
        if (isNaN(price) || price < 0) {
            alert('Por favor, ingrese un monto válido')
            return
        }
        setUpdatingPedidoId(pedidoId)
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ totalImporte: price }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al actualizar el precio')
            }
            
            // Actualización reactiva local
            if (showRendicionModal) {
                const updatedPedidos = showRendicionModal.pedidos.map(p => 
                    p.id === pedidoId ? { ...p, totalImporte: price } : p
                )
                const newMontoEsperado = updatedPedidos.reduce((sum, p) => sum + p.totalImporte, 0)
                setShowRendicionModal({
                    ...showRendicionModal,
                    pedidos: updatedPedidos,
                    montoEsperado: newMontoEsperado
                })
                setRendForm(f => ({ ...f, montoEntregado: newMontoEsperado.toString() }))
            }
            setEditingPedidoId(null)
            setEditingPedidoPrice('')
            fetchData()
        } catch (err: any) {
            alert(err.message || 'Error al actualizar el precio')
        } finally {
            setUpdatingPedidoId(null)
        }
    }

    async function handlePayByTransfer(pedidoId: string) {
        if (!window.confirm('¿Está seguro de marcar este pedido como abonado por transferencia? Se registrará el ingreso en MP Juani y se removerá de la rendición en efectivo.')) return
        setUpdatingPedidoId(pedidoId)
        try {
            const res = await fetch(`/api/pedidos/${pedidoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ medioPago: 'transferencia', abonado: true }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al registrar pago')
            }

            // Actualización reactiva local
            if (showRendicionModal) {
                const updatedPedidos = showRendicionModal.pedidos.filter(p => p.id !== pedidoId)
                if (updatedPedidos.length === 0) {
                    setShowRendicionModal(null)
                } else {
                    const newMontoEsperado = updatedPedidos.reduce((sum, p) => sum + p.totalImporte, 0)
                    setShowRendicionModal({
                        ...showRendicionModal,
                        pedidos: updatedPedidos,
                        pedidosEfectivo: updatedPedidos.length,
                        montoEsperado: newMontoEsperado
                    })
                    setRendForm(f => ({ ...f, montoEntregado: newMontoEsperado.toString() }))
                }
            }
            fetchData()
        } catch (err: any) {
            alert(err.message || 'Error al registrar pago por transferencia')
        } finally {
            setUpdatingPedidoId(null)
        }
    }

    async function handleRejectDelivery(entregaId: string, totalUnidades: number) {
        if (!window.confirm('¿Está seguro de rechazar este pedido por completo? El stock del pedido retornará a la fábrica y se removerá de la rendición.')) return
        setUpdatingPedidoId(entregaId)
        try {
            const res = await fetch(`/api/entregas/${entregaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unidadesRechazadas: totalUnidades,
                    motivoRechazo: 'otro',
                    observaciones: 'Rechazado por Admin en rendición'
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Error al rechazar pedido')
            }

            // Actualización reactiva local
            if (showRendicionModal) {
                const updatedPedidos = showRendicionModal.pedidos.filter(p => p.entregaId !== entregaId)
                if (updatedPedidos.length === 0) {
                    setShowRendicionModal(null)
                } else {
                    const newMontoEsperado = updatedPedidos.reduce((sum, p) => sum + p.totalImporte, 0)
                    setShowRendicionModal({
                        ...showRendicionModal,
                        pedidos: updatedPedidos,
                        pedidosEfectivo: updatedPedidos.length,
                        montoEsperado: newMontoEsperado
                    })
                    setRendForm(f => ({ ...f, montoEntregado: newMontoEsperado.toString() }))
                }
            }
            fetchData()
        } catch (err: any) {
            alert(err.message || 'Error al rechazar pedido')
        } finally {
            setUpdatingPedidoId(null)
        }
    }
    async function handleDeposit(e: React.FormEvent) {
        e.preventDefault()
        if (!depositAmount || !depositConfig) return
        setError('')
        if (depositoRequiereAdmin && (!depositAdminAuth.usuario.trim() || !depositAdminAuth.password)) {
            setError('Ingresá el usuario y la contraseña de un administrador para autorizar el excedente.')
            return
        }
        try {
            const cajaOrigen = userRol === 'ADMIN' ? selectedDepositTarget : depositConfig.cajaOrigenId
            const res = await fetch('/api/caja/depositos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    montoDeclarado: parseFloat(depositAmount),
                    cajaOrigen,
                    concepto: depositConfig.conceptoDeposito,
                    fecha: new Date().toISOString().split('T')[0],
                    autorizacionAdmin: depositoRequiereAdmin ? depositAdminAuth : undefined,
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                if (data.requiereAutorizacion) await fetchData()
                throw new Error(data.error || 'Error al registrar el depósito')
            }
            setSuccess(`Depósito registrado: el efectivo pasó a ${getBoxLabel(cajaRecepcionSeleccionada?.tipo || depositConfig.cajaRecepcionId)} y quedó pendiente de validación`)
            setDepositAdminAuth({ usuario: '', password: '' })
            setShowDepositModal(false)
            fetchData()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al depositar') }
    }

    function abrirValidacionDeposito(deposito: DepositoCaja) {
        const cajaQueEntrega = deposito.cajaRecepcion || deposito.cajaOrigen
        const destinos = allowedBoxes.filter(box => box !== cajaQueEntrega)
        const destinoPreferido = destinos.includes('caja_chica') ? 'caja_chica' : (destinos[0] || '')
        setValidacionDepositoForm({
            montoReal: String(deposito.montoDeclarado),
            cajaDestino: destinoPreferido,
            observaciones: '',
            fecha: new Date().toISOString().split('T')[0],
        })
        setShowValidacionDeposito(deposito)
    }

    async function handleValidarDeposito(e: React.FormEvent) {
        e.preventDefault()
        if (!showValidacionDeposito) return
        setError('')
        try {
            const res = await fetch('/api/caja/depositos', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: showValidacionDeposito.id,
                    montoReal: Number(validacionDepositoForm.montoReal),
                    cajaDestino: validacionDepositoForm.cajaDestino,
                    observaciones: validacionDepositoForm.observaciones,
                    fecha: validacionDepositoForm.fecha,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al validar el depósito')
            const diferencia = Number(data.diferencia || 0)
            setSuccess(diferencia === 0
                ? 'Depósito validado y transferido sin diferencias'
                : `Depósito validado: ${diferencia < 0 ? 'faltante' : 'sobrante'} de ${formatCurrency(Math.abs(diferencia))}`)
            setShowValidacionDeposito(null)
            fetchData()
            setTimeout(() => setSuccess(''), 5000)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al validar el depósito')
        }
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
                    <button className="btn btn-secondary" disabled={allowedBoxes.length < 2} onClick={() => setShowTransferModal(true)}>⇄ Transferir</button>
                    {depositConfig?.habilitarDeposito && (
                        <button className="btn btn-accent" 
                            style={{ backgroundColor: '#27AE60', color: 'white', border: 'none' }}
                            onClick={() => { 
                                setDepositAmount(''); 
                                setDepositAdminAuth({ usuario: '', password: '' });
                                setSelectedDepositTarget(depositConfig?.cajaOrigenId || cajasOrigenDeposito[0]?.tipo || '');
                                setShowDepositModal(true) 
                            }}>
                            💰 Depositar
                        </button>
                    )}
                    {userRol === 'ADMIN' && (
                        <Link className="btn btn-secondary" href="/cajas">Administrar cajas</Link>
                    )}
                    <button className="btn btn-primary" disabled={!allowedBoxes.length} onClick={() => { 
                        setEditingMov(null); 
                        setForm({ tipo: 'egreso', concepto: 'caja_chica', monto: '', medioPago: 'efectivo', descripcion: '', cajaOrigen: defaultBox, choferId: '', fecha: new Date().toISOString().split('T')[0] }); 
                        setShowModal(true) 
                    }}>+ Registrar Movimiento</button>

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
                            {formatCurrency(cajasCatalogo.reduce((total, caja) => total + caja.saldo, 0), showMontos)}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                            Suma de todas las cajas
                        </div>
                    </div>
                </div>
            )}

            {/* Cajas autorizadas, agrupadas visualmente por sede. */}
            <div style={{ display: 'grid', gap: 20, marginBottom: 24 }}>
                {cajasPorSucursal.map(grupo => (
                    <section key={grupo.clave} style={{ padding: 18, border: '1px solid var(--color-gray-200)', borderRadius: 14, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 12, background: grupo.tipo === 'LOCAL' ? '#ecfdf5' : '#eff6ff', fontSize: '1.25rem' }}>
                                    {grupo.tipo === 'LOCAL' ? '📍' : grupo.tipo === 'FABRICA' ? '🏭' : '🏦'}
                                </span>
                                <div>
                                    <div style={{ color: 'var(--color-gray-500)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                        {grupo.tipo === 'LOCAL' ? 'Sucursal' : grupo.tipo === 'FABRICA' ? 'Administración y fábrica' : 'Cajas'}
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{grupo.nombre}</h2>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: 'var(--color-gray-500)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Total de la sede</div>
                                <strong style={{ color: '#0f766e', fontSize: '1.35rem' }}>{formatCurrency(grupo.total, showMontos)}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                            {grupo.cajas.map(caja => (
                                <div key={caja.id} className="card" style={{ minWidth: 0, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' }}>
                                    <div className="card-body" style={{ display: 'flex', minHeight: 168, flexDirection: 'column', padding: 18 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                            <strong style={{ fontSize: '0.95rem', lineHeight: 1.35 }}>{caja.nombre || caja.tipo}</strong>
                                            {caja.recibeDepositos && <span className="badge" style={{ flexShrink: 0, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.62rem' }}>Depósitos</span>}
                                        </div>
                                        {editingSaldo === caja.tipo ? (
                                            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                                                <input aria-label="Saldo" type="number" step="0.01" className="form-input" value={editSaldoValue} onChange={e => setEditSaldoValue(e.target.value)} />
                                                <select aria-label="Motivo de ajuste" className="form-select" value={editMotivo} onChange={e => setEditMotivo(e.target.value)}><option value="ajuste">Ajuste</option><option value="arqueo">Arqueo</option></select>
                                                <input aria-label="Detalle de ajuste" className="form-input" placeholder="Detalle" value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => void updateSaldo(caja.tipo)}>Guardar ajuste</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingSaldo(null)}>Cancelar</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ marginTop: 18, fontSize: '1.75rem', fontWeight: 800, color: caja.saldo < 0 ? '#dc2626' : '#2563eb', lineHeight: 1.1 }}>
                                                    {formatCurrency(caja.saldo, showMontos)}
                                                </div>
                                                {userRol === 'ADMIN' && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginTop: 'auto' }} onClick={() => { setEditingSaldo(caja.tipo); setEditSaldoValue(String(caja.saldo)) }}>Ajustar saldo</button>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
            {!loading && !cajasActivas.length && <p role="status">No hay cajas activas vinculadas a tu sede. Solicitá la vinculación a Administración.</p>}

            {/* ═══ Rendiciones Pendientes ═══ */}
            {depositosPendientes.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem' }}>
                        {userRol === 'ADMIN' ? 'Depósitos pendientes de validar' : 'Tus depósitos pendientes de validación'}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 'var(--space-4)' }}>
                        {depositosPendientes.map(deposito => (
                            <div key={deposito.id} className="card" style={{ borderLeft: '4px solid #F39C12' }}>
                                <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div>
                                            <strong>{nombreUsuario(deposito.declaradoPor)}</strong>
                                            <div style={{ color: 'var(--color-gray-500)', fontSize: '0.8rem', marginTop: 3 }}>
                                                {new Date(deposito.fecha).toLocaleString('es-AR')} · {getBoxLabel(deposito.cajaOrigen)}
                                                {deposito.cajaRecepcion ? ` → ${getBoxLabel(deposito.cajaRecepcion)}` : ''}
                                            </div>
                                        </div>
                                        <span className="badge" style={{ backgroundColor: '#FFF7E6', color: '#B45309', border: '1px solid #F59E0B' }}>
                                            Pendiente
                                        </span>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-4)', color: 'var(--color-gray-500)', fontSize: '0.8rem' }}>Monto declarado</div>
                                    <div style={{ fontSize: '1.65rem', fontWeight: 700 }}>{formatCurrency(deposito.montoDeclarado, showMontos)}</div>
                                    {userRol === 'ADMIN' && (
                                        <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-4)' }} onClick={() => abrirValidacionDeposito(deposito)}>
                                            Validar y transferir
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {rendiciones.length > 0 && (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)', fontSize: '1rem' }}>🚛 Rendiciones Pendientes de Choferes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {rendiciones.map((r) => (
                            <div key={r.rutaId} className="card" style={{ 
                                borderLeft: `4px solid ${r.bloqueada ? '#BDC3C7' : '#F39C12'}`,
                                opacity: r.bloqueada ? 0.75 : 1
                            }}>
                                <div className="card-body" style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>🧑‍✈️ {r.choferNombre}</span>
                                        <span className="badge" style={{ 
                                            backgroundColor: r.bloqueada ? '#E2E8F0' : '#F39C1215', 
                                            color: r.bloqueada ? '#64748B' : '#E67E22', 
                                            border: `1px solid ${r.bloqueada ? '#CBD5E1' : '#F39C12'}` 
                                        }}>
                                            {r.bloqueada ? 'Bloqueada' : 'Pendiente'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: 'var(--space-1)' }}>
                                        📅 Ruta: {new Date(r.fecha).toLocaleDateString('es-AR')} {r.turno ? `(${r.turno.toUpperCase()})` : ''}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginBottom: 'var(--space-2)' }}>
                                        📦 {r.pedidosEfectivo} pedidos en efectivo
                                    </div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: r.bloqueada ? '#7F8C8D' : '#E67E22', marginBottom: 'var(--space-3)' }}>
                                        {formatCurrency(r.montoEsperado)}
                                    </div>
                                    {r.bloqueada ? (
                                        <div style={{ 
                                            fontSize: '0.75rem', 
                                            color: '#E74C3C', 
                                            textAlign: 'center', 
                                            padding: '8px', 
                                            backgroundColor: '#E74C3C10', 
                                            borderRadius: 'var(--radius-md)',
                                            fontWeight: 600
                                        }}>
                                            ⚠️ Debe rendir la ruta anterior primero
                                        </div>
                                    ) : (
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                                            setShowRendicionModal(r)
                                            setRendForm({ montoEntregado: String(r.montoEsperado), observaciones: '' })
                                        }}>
                                            ✅ Controlado
                                        </button>
                                    )}
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

            {/* ═══ Barra de Filtros ═══ */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)' }}>🔍</span>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Buscar por concepto, descripción, chofer..." 
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            style={{ paddingLeft: '35px', width: '100%', fontSize: '0.9rem' }}
                        />
                    </div>
                    <div style={{ flex: '0 0 200px' }}>
                        <select 
                            className="form-select" 
                            value={filtroCaja}
                            onChange={(e) => setFiltroCaja(e.target.value)}
                            style={{ fontSize: '0.9rem' }}
                        >
                            <option value="todas">🏦 Todas las Cajas</option>
                            {allowedBoxes.map(box => (
                                <option key={box} value={box}>{getBoxLabel(box)}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: '0 0 160px' }}>
                        <select 
                            className="form-select" 
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            style={{ fontSize: '0.9rem' }}
                        >
                            <option value="todos">🎭 Todos los Tipos</option>
                            <option value="ingreso">⬆️ Ingresos</option>
                            <option value="egreso">⬇️ Egresos</option>
                        </select>
                    </div>
                    {(filtroTexto || filtroCaja !== 'todas' || filtroTipo !== 'todos') && (
                        <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => { setFiltroTexto(''); setFiltroCaja('todas'); setFiltroTipo('todos'); }}
                            style={{ color: 'var(--color-danger)', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                            🧹 Limpiar Filtros
                        </button>
                    )}
                    <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-gray-500)', fontWeight: 600 }}>
                        {movimientosFiltrados.length} resultados
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
                            <th>Registrado por</th>
                            <th>Hora</th>
                            <th style={{ width: 110 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movimientosFiltrados.length === 0 ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-400)' }}>No se encontraron movimientos con estos filtros</td></tr>
                        ) : movimientosFiltrados.map((m: MovCaja) => (
                            <tr key={m.id} style={m.estado === 'anulado' ? { opacity: 0.65, backgroundColor: '#f8fafc' } : undefined}>
                                <td>
                                    <span className="badge" style={{
                                        backgroundColor: m.tipo === 'ingreso' ? '#2ECC7115' : '#E74C3C15',
                                        color: m.tipo === 'ingreso' ? '#27AE60' : '#E74C3C',
                                        border: `1px solid ${m.tipo === 'ingreso' ? '#2ECC7140' : '#E74C3C40'}`,
                                    }}>
                                        {m.tipo === 'ingreso' ? '⬆️' : '⬇️'} {m.tipo}
                                    </span>
                                    {m.estado === 'anulado' && (
                                        <div><span className="badge" style={{ marginTop: 4, color: '#b42318', background: '#fef3f2' }}>ANULADO</span></div>
                                    )}
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
                                        {getBoxLabel(m.cajaOrigen)}
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
                                <td style={{ fontSize: '0.78rem', minWidth: 130 }}>
                                    <strong>{nombreUsuario(m.creadoPor)}</strong>
                                    {m.actualizadoPor && (
                                        <div style={{ color: 'var(--color-gray-500)', marginTop: 2 }}>
                                            Editado por {nombreUsuario(m.actualizadoPor)}
                                        </div>
                                    )}
                                    {m.estado === 'anulado' && (
                                        <div style={{ color: '#b42318', marginTop: 2 }}>
                                            Anulado por {nombreUsuario(m.anuladoPor)}
                                        </div>
                                    )}
                                </td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                                    {new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        {userRol === 'ADMIN' && (
                                            <button className="btn btn-ghost btn-sm" title="Ver trazabilidad" style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                                                onClick={() => setAuditMov(m)}>📜</button>
                                        )}
                                        {m.estado === 'anulado' ? null : m.gestionadoPorDeposito ? <span
                                            className="badge"
                                            title="Este movimiento forma parte de un depósito validado y se conserva como trazabilidad."
                                            style={{ color: '#92400e', background: '#fffbeb', fontSize: '10px', whiteSpace: 'nowrap' }}
                                        >Depósito</span> : m.gestionadoPorRRHH ? <span
                                            className="badge"
                                            title="Este movimiento se gestiona desde Empleados. Podés corregir su caja o anularlo desde RR. HH."
                                            style={{ color: '#175cd3', background: '#eff8ff', fontSize: '10px', whiteSpace: 'nowrap' }}
                                        >🔒 RRHH</span> : <>
                                        <button className="btn btn-ghost btn-sm" title="Editar" style={{ fontSize: '0.8rem', padding: '2px 6px' }}
                                            onClick={() => startEdit(m)}>✏️</button>
                                        <button className="btn btn-ghost btn-sm" title="Anular" style={{ fontSize: '0.8rem', padding: '2px 6px', color: 'var(--color-danger)' }}
                                            onClick={() => handleDelete(m.id)}>⊘</button>
                                        </>}
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
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                        {allowedBoxes.map((boxKey) => {
                                            const boxColors: Record<string, string> = {
                                                'caja_chica': '#E67E22',
                                                'caja_chica_local': '#F39C12',
                                                'mercado_pago': '#2980B9',
                                                'mercado_pago_juani': '#00BFA5'
                                            };
                                            const color = boxColors[boxKey] || 'var(--color-primary)';
                                            return (
                                                <button key={boxKey} type="button" className="btn btn-sm"
                                                    onClick={() => {
                                                        const isMP = boxKey === 'mercado_pago' || boxKey === 'mercado_pago_juani';
                                                        setForm({ 
                                                            ...form, 
                                                            cajaOrigen: boxKey,
                                                            medioPago: isMP ? 'transferencia' : form.medioPago
                                                        });
                                                    }}
                                                    style={{ 
                                                        flex: '1 1 120px', 
                                                        backgroundColor: form.cajaOrigen === boxKey ? color : `${color}18`, 
                                                        color: form.cajaOrigen === boxKey ? '#fff' : color, 
                                                        border: `2px solid ${color}`, 
                                                        fontWeight: 600, 
                                                        fontSize: '0.8rem',
                                                        padding: 'var(--space-2)'
                                                    }}>
                                                    {getBoxLabel(boxKey)}
                                                </button>
                                            );
                                        })}
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
                                            {choferes.filter(e => e.activo && (e.rolRel?.permisoLogistica === true || (!e.rolRel && e.rol === 'LOGISTICA'))).map(c => (
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
                                        {form.cajaOrigen !== 'mercado_pago' && form.cajaOrigen !== 'mercado_pago_juani' && (
                                            <button type="button" className="btn btn-sm"
                                                onClick={() => setForm({ ...form, medioPago: 'efectivo' })}
                                                style={{ flex: 1, backgroundColor: form.medioPago === 'efectivo' ? '#27AE60' : '#27AE6018', color: form.medioPago === 'efectivo' ? '#fff' : '#27AE60', border: '2px solid #27AE60', fontWeight: 600 }}>
                                                💵 Efectivo
                                            </button>
                                        )}
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
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>Chofer</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>🧑‍✈️ {showRendicionModal.choferNombre}</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', marginTop: '4px' }}>
                                    📅 Ruta: {new Date(showRendicionModal.fecha).toLocaleDateString('es-AR')} 
                                    {showRendicionModal.turno ? ` (${showRendicionModal.turno.toUpperCase()})` : ''}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: '#F39C1210', borderRadius: 'var(--radius-md)', border: '1px solid #F39C1240' }}>
                                <div style={{ fontSize: '0.75rem', color: '#E67E22', fontWeight: 600, textTransform: 'uppercase' }}>Monto Esperado</div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#E67E22' }}>{formatCurrency(showRendicionModal.montoEsperado)}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-gray-500)' }}>{showRendicionModal.pedidosEfectivo} pedidos en efectivo</div>
                            </div>

                            {/* Desglose de pedidos */}
                            <div style={{ marginBottom: 'var(--space-4)' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Desglose de Pedidos</div>
                                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', backgroundColor: 'var(--color-gray-50)' }}>
                                    {showRendicionModal.pedidos?.map((ped) => (
                                        editingPedidoId === ped.id ? (
                                            <div key={ped.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 6px', borderBottom: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-sm)', marginBottom: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={ped.clienteNombre}>
                                                        🏢 {ped.clienteNombre}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', fontWeight: 500 }}>({ped.totalUnidades} u.)</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <input
                                                        type="number"
                                                        value={editingPedidoPrice}
                                                        onChange={(e) => setEditingPedidoPrice(e.target.value)}
                                                        className="form-input"
                                                        style={{ padding: '2px 8px', fontSize: '0.85rem', height: '28px', flex: 1, margin: 0 }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary"
                                                        style={{ padding: '0 10px', height: '28px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onClick={() => handleSavePrice(ped.id)}
                                                        disabled={updatingPedidoId === ped.id}
                                                    >
                                                        {updatingPedidoId === ped.id ? '...' : '💾'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0 8px', height: '28px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onClick={() => { setEditingPedidoId(null); setEditingPedidoPrice('') }}
                                                        disabled={updatingPedidoId === ped.id}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div key={ped.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 6px', borderBottom: '1px solid var(--color-gray-150)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px', fontSize: '0.85rem' }} title={ped.clienteNombre}>
                                                        🏢 {ped.clienteNombre} <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', fontWeight: 400 }}>({ped.totalUnidades} u.)</span>
                                                    </span>
                                                    <span style={{ fontWeight: 700, color: 'var(--color-gray-700)', fontSize: '0.85rem' }}>
                                                        {formatCurrency(ped.totalImporte)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '2px' }}>
                                                    {updatingPedidoId === ped.id || updatingPedidoId === ped.entregaId ? (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>⏳ Actualizando...</span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                title="Editar precio"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                onClick={() => {
                                                                    setEditingPedidoId(ped.id)
                                                                    setEditingPedidoPrice(ped.totalImporte.toString())
                                                                }}
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Abonado por Transferencia (TR)"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                onClick={() => handlePayByTransfer(ped.id)}
                                                            >
                                                                🏦
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Rechazar pedido por completo"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                onClick={() => handleRejectDelivery(ped.entregaId, ped.totalUnidades)}
                                                            >
                                                                ❌
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                    {(!showRendicionModal.pedidos || showRendicionModal.pedidos.length === 0) && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-400)', textAlign: 'center', padding: '12px' }}>No hay detalles de pedidos</div>
                                    )}
                                </div>
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
                                            {allowedBoxes.map(box => (
                                                <option key={box} value={box}>{getBoxLabel(box)}</option>
                                            ))}
                                        </select>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                            Saldo: {formatCurrency(getBoxSaldo(transfForm.origen), showMontos)}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Hacia</label>
                                        <select className="form-select" value={transfForm.destino} onChange={(e) => setTransfForm({ ...transfForm, destino: e.target.value })}>
                                            {allowedBoxes.map(box => (
                                                <option key={box} value={box}>{getBoxLabel(box)}</option>
                                            ))}
                                        </select>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                            Saldo: {formatCurrency(getBoxSaldo(transfForm.destino), showMontos)}
                                        </div>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Monto ($)</label>
                                    <input type="number" step="0.01" min="0.01" className="form-input" placeholder="0.00" value={transfForm.monto}
                                        onChange={(e) => setTransfForm({ ...transfForm, monto: e.target.value })} required 
                                        style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: 700 }} />
                                    {parseFloat(transfForm.monto) > getBoxSaldo(transfForm.origen) && (
                                        <div style={{ color: '#E74C3C', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600, textAlign: 'center' }}>
                                            ⚠️ El monto supera el saldo disponible
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowTransferModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={parseFloat(transfForm.monto) > getBoxSaldo(transfForm.origen) || !transfForm.monto || parseFloat(transfForm.monto) <= 0}>Realizar Transferencia</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE DEPOSITO RÁPIDO */}
            {showValidacionDeposito && userRol === 'ADMIN' && (() => {
                const montoReal = Number(validacionDepositoForm.montoReal || 0)
                const diferencia = Math.round((montoReal - showValidacionDeposito.montoDeclarado) * 100) / 100
                const hayDiferencia = diferencia !== 0
                return (
                    <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowValidacionDeposito(null)}>
                        <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div>
                                    <h2>Validar depósito</h2>
                                    <div style={{ color: 'var(--color-gray-500)', fontSize: '0.85rem', marginTop: 4 }}>
                                        Declarado por {nombreUsuario(showValidacionDeposito.declaradoPor)}
                                    </div>
                                </div>
                                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowValidacionDeposito(null)}>×</button>
                            </div>
                            <form onSubmit={handleValidarDeposito}>
                                <div className="modal-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                                        <div style={{ padding: '12px', background: 'var(--color-gray-50)', borderRadius: 8 }}>
                                            <div style={{ color: 'var(--color-gray-500)', fontSize: '0.75rem' }}>DECLARADO</div>
                                            <strong style={{ fontSize: '1.25rem' }}>{formatCurrency(showValidacionDeposito.montoDeclarado)}</strong>
                                        </div>
                                        <div style={{ padding: '12px', background: hayDiferencia ? '#FFF7E6' : '#ECFDF5', borderRadius: 8 }}>
                                            <div style={{ color: 'var(--color-gray-500)', fontSize: '0.75rem' }}>DIFERENCIA</div>
                                            <strong style={{ fontSize: '1.25rem', color: diferencia < 0 ? '#DC2626' : diferencia > 0 ? '#16A34A' : '#15803D' }}>
                                                {hayDiferencia ? `${diferencia < 0 ? 'Faltante' : 'Sobrante'} ${formatCurrency(Math.abs(diferencia))}` : 'Sin diferencia'}
                                            </strong>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Monto real contado ($)</label>
                                        <input type="number" min="0" step="0.01" className="form-input" value={validacionDepositoForm.montoReal}
                                            onChange={e => setValidacionDepositoForm({ ...validacionDepositoForm, montoReal: e.target.value })}
                                            style={{ fontSize: '1.35rem', textAlign: 'center', fontWeight: 700 }} autoFocus required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Transferir el monto real hacia</label>
                                        <select className="form-select" value={validacionDepositoForm.cajaDestino}
                                            onChange={e => setValidacionDepositoForm({ ...validacionDepositoForm, cajaDestino: e.target.value })}
                                            disabled={montoReal === 0} required={montoReal > 0}>
                                            {allowedBoxes.filter(box => box !== (showValidacionDeposito.cajaRecepcion || showValidacionDeposito.cajaOrigen)).map(box => (
                                                <option key={box} value={box}>{getBoxLabel(box)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha del retiro</label>
                                        <input type="date" className="form-input" value={validacionDepositoForm.fecha}
                                            onChange={e => setValidacionDepositoForm({ ...validacionDepositoForm, fecha: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Observaciones {hayDiferencia ? '(obligatorias)' : '(opcionales)'}</label>
                                        <textarea className="form-input" rows={3} value={validacionDepositoForm.observaciones}
                                            onChange={e => setValidacionDepositoForm({ ...validacionDepositoForm, observaciones: e.target.value })}
                                            placeholder={hayDiferencia ? 'Ej.: faltante detectado al contar el efectivo' : 'Detalle del control'}
                                            required={hayDiferencia} minLength={hayDiferencia ? 5 : undefined} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowValidacionDeposito(null)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" disabled={montoReal < 0 || (montoReal > 0 && !validacionDepositoForm.cajaDestino)}>
                                        {montoReal > 0 ? `Validar y transferir ${formatCurrency(montoReal)}` : 'Validar sin transferencia'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            })()}

            {showDepositModal && (
                <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowDepositModal(false)}>
                    <div className="modal" style={{ maxWidth: '400px', backgroundColor: '#ffffff', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>💰 Informar depósito</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowDepositModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleDeposit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                {userRol === 'ADMIN' ? (
                                    <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                                        <label className="form-label" style={{ fontWeight: 600 }}>Caja Chica de origen</label>
                                        <select 
                                            className="form-input" 
                                            value={selectedDepositTarget}
                                            onChange={(e) => setSelectedDepositTarget(e.target.value)}
                                            style={{ backgroundColor: '#f9f9f9', fontWeight: 600 }}
                                        >
                                            {cajasOrigenDeposito.map(caja => (
                                                <option key={caja.tipo} value={caja.tipo}>{getBoxLabel(caja.tipo)}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--color-gray-600)', marginBottom: '1.5rem', textAlign: 'center' }}>
                                        El depósito se descontará de {getBoxLabel(depositConfig?.cajaOrigenId)}
                                        {' '}y pasará a {getBoxLabel(depositConfig?.cajaRecepcionId)} hasta su validación
                                    </p>
                                )}
                                
                                <div style={{ textAlign: 'center' }}>
                                    <label className="form-label" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Importe declarado</label>
                                    <p style={{ margin: '0.4rem 0 0.75rem', color: 'var(--color-gray-600)' }}>
                                        Disponible en {getBoxLabel(cajaDepositoSeleccionada)}: <strong>{formatCurrency(Math.max(0, saldoDisponibleDeposito), showMontos)}</strong>
                                    </p>
                                    {cajaRecepcionSeleccionada && (
                                        <p style={{ margin: '0 0 0.75rem', color: '#047857', fontWeight: 600 }}>
                                            El sobre ingresará en {getBoxLabel(cajaRecepcionSeleccionada.tipo)}
                                        </p>
                                    )}
                                    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '1.2rem' }}>$</span>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            className="form-input" 
                                            style={{ paddingLeft: '30px', fontSize: '1.5rem', textAlign: 'center', height: '60px' }}
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            placeholder="0.00"
                                            min="0.01"
                                            autoFocus
                                            required 
                                        />
                                    </div>
                                </div>
                                {depositoRequiereAdmin && (
                                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 10, background: '#fff7ed', border: '1px solid #fdba74', textAlign: 'left' }}>
                                        <strong>Requiere autorización administrativa</strong>
                                        <p style={{ margin: '0.35rem 0 0.9rem', color: '#9a3412' }}>
                                            El importe supera el saldo disponible. Un administrador debe ingresar sus credenciales para continuar.
                                        </p>
                                        <label className="form-group">
                                            <span className="form-label">Usuario administrador (email)</span>
                                            <input type="email" className="form-input" autoComplete="username"
                                                value={depositAdminAuth.usuario}
                                                onChange={e => setDepositAdminAuth({ ...depositAdminAuth, usuario: e.target.value })}
                                                required />
                                        </label>
                                        <label className="form-group">
                                            <span className="form-label">Contraseña</span>
                                            <input type="password" className="form-input" autoComplete="current-password"
                                                value={depositAdminAuth.password}
                                                onChange={e => setDepositAdminAuth({ ...depositAdminAuth, password: e.target.value })}
                                                required />
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowDepositModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#27AE60' }}
                                    disabled={!depositAmount || montoDeposito <= 0 || (depositoRequiereAdmin && (!depositAdminAuth.usuario.trim() || !depositAdminAuth.password))}>
                                    Informar depósito
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {auditMov && userRol === 'ADMIN' && (
                <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setAuditMov(null)}>
                    <div className="modal" style={{ maxWidth: 720, width: '95%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Trazabilidad del movimiento</h2>
                                <div style={{ color: 'var(--color-gray-500)', fontSize: '0.85rem', marginTop: 4 }}>
                                    {auditMov.concepto} · {formatCurrency(auditMov.monto)} · {getBoxLabel(auditMov.cajaOrigen)}
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setAuditMov(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                            {(auditMov.auditorias || []).length === 0 ? (
                                <div className="empty-state" style={{ padding: '2rem' }}>
                                    Movimiento histórico: no posee eventos de auditoría anteriores a esta actualización.
                                </div>
                            ) : (auditMov.auditorias || []).map(auditoria => {
                                const cambios = cambiosAuditoria(auditoria)
                                return (
                                    <div key={auditoria.id} style={{ border: '1px solid var(--color-gray-200)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                            <strong>{accionesAuditoria[auditoria.accion] || auditoria.accion}</strong>
                                            <span style={{ color: 'var(--color-gray-500)', fontSize: '0.8rem' }}>
                                                {new Date(auditoria.createdAt).toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                        <div style={{ marginTop: 4, fontSize: '0.85rem' }}>
                                            Responsable: <strong>{nombreUsuario(auditoria.usuario)}</strong>
                                        </div>
                                        {auditoria.motivo && (
                                            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff7ed', borderRadius: 6, fontSize: '0.85rem' }}>
                                                Motivo: {auditoria.motivo}
                                            </div>
                                        )}
                                        {cambios.length > 0 && (
                                            <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                                                {cambios.map(cambio => (
                                                    <div key={cambio.clave} style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
                                                        <strong>{etiquetasAuditoria[cambio.clave] || cambio.clave}</strong>
                                                        <span>
                                                            {auditoria.accion !== 'CREACION' && <><span style={{ color: '#b42318' }}>{valorAuditoria(cambio.clave, cambio.anterior)}</span> → </>}
                                                            <span style={{ color: '#067647' }}>{valorAuditoria(cambio.clave, cambio.nuevo)}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
